import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  Inject,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { AuthRequest, Public, Roles, Feature, systemActor } from './security';
import {
  parse,
  name,
  phone,
  email,
  cents,
  uuid,
  datetime,
  paymentMethod,
  status,
  date,
} from './validation';
import { AuthService } from '../application/auth.service';
import { GoogleIdentity } from '../infrastructure/google-identity';
import { CatalogService, Entity } from '../application/catalog.service';
import { AppointmentsService } from '../application/appointments.service';
import { InsightsService } from '../application/insights.service';
import { MasterService } from '../application/master.service';
import { ReportsService } from '../application/reports.service';
import { Database, audit } from '../infrastructure/database';
const booking = z
  .object({ clientId: uuid, barberId: uuid, serviceId: uuid, startsAt: datetime })
  .strict();
const schemas = {
  services: z
    .object({
      name,
      description: z.string().max(500).optional(),
      durationMinutes: z.number().int().min(5).max(480),
      priceCents: cents,
      active: z.boolean().optional(),
    })
    .strict(),
  clients: z
    .object({
      name,
      phone,
      email: email.optional(),
      birthDate: date.optional().transform((v) => (v ? new Date(`${v}T00:00:00Z`) : undefined)),
      whatsappConsent: z.boolean().optional(),
      active: z.boolean().optional(),
    })
    .strict(),
  barbers: z
    .object({
      name,
      email: email.optional(),
      phone: phone.optional(),
      unitId: uuid,
      commissionPercent: z.number().int().min(0).max(100),
      goalCents: cents.optional(),
      active: z.boolean().optional(),
    })
    .strict(),
  units: z.object({ name, address: z.string().max(500).optional() }).strict(),
  entries: z
    .object({
      description: name,
      type: z.enum(['INCOME', 'EXPENSE']),
      amountCents: cents.refine((n) => n > 0),
      method: paymentMethod,
      categoryId: uuid.optional(),
      occurredAt: datetime.optional().transform((v) => (v ? new Date(v) : undefined)),
    })
    .strict(),
  products: z
    .object({
      name,
      sku: z.string().min(2).max(50),
      quantity: z.number().int().nonnegative().optional().default(0),
      minimum: z.number().int().nonnegative().optional().default(5),
      costCents: cents,
      priceCents: cents,
      categoryId: uuid.optional(),
      supplierId: uuid.optional(),
    })
    .strict(),
  categories: z.object({ name, kind: z.enum(['FINANCIAL', 'STOCK']) }).strict(),
  suppliers: z.object({ name, phone: phone.optional(), email: email.optional() }).strict(),
};
const catalogPaths = [
  'services',
  'clients',
  'barbers',
  'units',
  'financial/entries',
  'stock/products',
  'categories',
  'suppliers',
];
function entityFor(path: string): Entity {
  const last = path
    .replace(/\/[0-9a-f-]{36}$/i, '')
    .split('/')
    .pop()!;
  return last as Entity;
}
function range(query: any) {
  const from = query.from
      ? new Date(parse(datetime, query.from))
      : new Date(Date.now() - 30 * 86400000),
    to = query.to ? new Date(parse(datetime, query.to)) : new Date();
  if (to < from || +to - +from > 366 * 86400000)
    throw new BadRequestException('Período inválido; máximo de 366 dias.');
  return { from, to };
}
function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/api/auth',
    maxAge: 7 * 86400000,
  };
}

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private auth: AuthService,
    @Inject(MasterService) private master: MasterService,
    @Inject(GoogleIdentity) private google: GoogleIdentity,
  ) {}
  @Get('me') async me(@Req() req: AuthRequest) {
    return this.auth.me(req.actor);
  }
  @Get('google/config') @Public() async googleConfig(@Res({ passthrough: true }) res: Response) {
    const config = await this.google.challenge();
    res.setHeader('Cache-Control', 'no-store');
    if (config.enabled)
      res.cookie('bh_google_nonce', config.nonce, { ...cookieOptions(), maxAge: 300000 });
    return config;
  }
  @Post('google') @Public() async googleLogin(
    @Body() body: unknown,
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = parse(
      z
        .object({
          slug: z.string().min(2).max(80),
          credential: z.string().min(20).max(10000),
          portal: z.enum(['master', 'team', 'client']),
          registration: z
            .object({ phone, whatsappConsent: z.boolean().default(false) })
            .strict()
            .optional(),
        })
        .strict(),
      body,
    );
    const identity = await this.google.verify(input.credential, req.cookies.bh_google_nonce);
    res.clearCookie('bh_google_nonce', { ...cookieOptions(), maxAge: undefined });
    const result = await this.auth.googleLogin(
      input.slug,
      identity,
      input.portal,
      input.registration,
    );
    res.cookie('bh_refresh', result.refreshToken, cookieOptions());
    const { refreshToken, ...publicResult } = result;
    return publicResult;
  }
  @Post('google/link') async linkGoogle(
    @Body() body: unknown,
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = parse(z.object({ credential: z.string().min(20).max(10000) }).strict(), body);
    const identity = await this.google.verify(input.credential, req.cookies.bh_google_nonce);
    res.clearCookie('bh_google_nonce', { ...cookieOptions(), maxAge: undefined });
    return this.auth.linkGoogle(req.actor, identity);
  }
  @Post('register-company') @Public() async registerCompany(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = parse(
      z
        .object({
          name,
          slug: z
            .string()
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
            .min(3)
            .max(80)
            .refine((v) => v !== 'master'),
          admin: z.object({ name, email, password: z.string().min(12).max(128) }).strict(),
        })
        .strict(),
      body,
    );
    await this.master.create(systemActor, { ...input, planCode: 'START' });
    const result = await this.auth.login(
      input.slug,
      input.admin.email,
      input.admin.password,
      'team',
    );
    res.cookie('bh_refresh', result.refreshToken, cookieOptions());
    const { refreshToken, ...publicResult } = result;
    return publicResult;
  }
  @Post('login') @Public() async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = parse(
      z
        .object({
          slug: z.string().min(2).max(80),
          email,
          password: z.string().min(8).max(128),
          portal: z.enum(['master', 'team', 'client']).default('team'),
        })
        .strict(),
      body,
    );
    const result = await this.auth.login(input.slug, input.email, input.password, input.portal);
    res.cookie('bh_refresh', result.refreshToken, cookieOptions());
    const { refreshToken, ...publicResult } = result;
    return publicResult;
  }
  @Post('register') @Public() async register(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = parse(
      z
        .object({
          slug: z.string().min(2).max(80),
          name,
          phone,
          email,
          password: z.string().min(12).max(128),
          whatsappConsent: z.boolean().default(false),
        })
        .strict(),
      body,
    );
    const result = await this.auth.register(input);
    res.cookie('bh_refresh', result.refreshToken, cookieOptions());
    const { refreshToken, ...publicResult } = result;
    return publicResult;
  }
  @Post('refresh') @Public() async refresh(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { refreshToken, ...result } = await this.auth.refresh(req.cookies.bh_refresh);
    res.cookie('bh_refresh', refreshToken, cookieOptions());
    return result;
  }
  @Post('logout') @Public() async logout(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(req.cookies.bh_refresh);
    res.clearCookie('bh_refresh', { ...cookieOptions(), maxAge: undefined });
    return { success: true };
  }
}
@ApiTags('Cadastros')
@ApiBearerAuth()
@Roles('EMPRESA', 'BARBEIRO', 'CLIENTE')
@Controller()
export class CatalogController {
  constructor(@Inject(CatalogService) private catalog: CatalogService) {}
  @Get(catalogPaths) list(@Req() req: AuthRequest) {
    const entity = entityFor(req.path);
    if (
      ['entries', 'products', 'categories', 'suppliers'].includes(entity) &&
      req.actor.role !== 'EMPRESA'
    )
      throw new ForbiddenException();
    return this.catalog.list(req.actor, entity);
  }
  @Post(catalogPaths) @Roles('EMPRESA') create(@Req() req: AuthRequest, @Body() body: unknown) {
    const entity = entityFor(req.path);
    return this.catalog.create(req.actor, entity, parse(schemas[entity], body));
  }
  @Patch(catalogPaths.map((p) => `${p}/:id`)) @Roles('EMPRESA') update(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const entity = entityFor(req.path);
    const schema =
      entity === 'products'
        ? schemas.products.omit({ quantity: true }).partial()
        : schemas[entity].partial();
    return this.catalog.update(req.actor, entity, parse(uuid, id), parse(schema, body));
  }
  @Post('stock/products/:id/movements') @Roles('EMPRESA') @Feature('stock') move(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = parse(
      z
        .object({
          delta: z
            .number()
            .int()
            .min(-100000)
            .max(100000)
            .refine((n) => n !== 0),
          reason: name,
        })
        .strict(),
      body,
    );
    return this.catalog.stockMove(req.actor, parse(uuid, id), input.delta, input.reason);
  }
  @Get('stock/products/:id/movements') @Roles('EMPRESA') @Feature('stock') history(
    @Req() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.catalog.stockHistory(req.actor, parse(uuid, id));
  }
}
@ApiTags('Agenda')
@ApiBearerAuth()
@Roles('EMPRESA', 'BARBEIRO', 'CLIENTE')
@Controller('appointments')
export class AppointmentsController {
  constructor(@Inject(AppointmentsService) private appointments: AppointmentsService) {}
  @Get() list(@Req() req: AuthRequest, @Query() query: any) {
    const { from, to } = range({
      ...query,
      to: query.to || new Date(Date.now() + 90 * 86400000).toISOString(),
    });
    return this.appointments.list(req.actor, from, to);
  }
  @Get('slots') slots(@Req() req: AuthRequest, @Query() query: any) {
    const input = parse(z.object({ barberId: uuid, serviceId: uuid, date }), query);
    return this.appointments.slots(req.actor, input.barberId, input.serviceId, input.date);
  }
  @Post() create(@Req() req: AuthRequest, @Body() body: unknown) {
    return this.appointments.create(req.actor, parse(booking, body));
  }
  @Patch(':id/reschedule') reschedule(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.appointments.reschedule(req.actor, parse(uuid, id), parse(booking, body));
  }
  @Patch(':id/status') status(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = parse(z.object({ status, method: paymentMethod.default('PIX') }).strict(), body);
    return this.appointments.status(req.actor, parse(uuid, id), input.status, input.method);
  }
  @Post(':id/review') @Roles('CLIENTE') review(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = parse(
      z
        .object({
          rating: z.number().int().min(1).max(5),
          comment: z.string().max(1000).optional(),
        })
        .strict(),
      body,
    );
    return this.appointments.review(req.actor, parse(uuid, id), input.rating, input.comment);
  }
}
@ApiTags('Gestão')
@ApiBearerAuth()
@Controller()
export class InsightsController {
  constructor(
    @Inject(InsightsService) private insights: InsightsService,
    @Inject(AppointmentsService) private appointments: AppointmentsService,
    @Inject(Database) private db: Database,
  ) {}
  @Get('dashboard') @Roles('EMPRESA', 'BARBEIRO') @Feature('dashboard') dashboard(
    @Req() req: AuthRequest,
    @Query() query: any,
  ) {
    const { from, to } = range(query);
    return this.insights.dashboard(req.actor, from, to);
  }
  @Get('commissions') @Roles('EMPRESA', 'BARBEIRO') @Feature('commissions') commissions(
    @Req() req: AuthRequest,
    @Query() query: any,
  ) {
    const { from, to } = range(query);
    return this.insights.commissions(req.actor, from, to);
  }
  @Get('financial/dre') @Roles('EMPRESA') @Feature('financial_advanced') dre(
    @Req() req: AuthRequest,
    @Query() query: any,
  ) {
    const { from, to } = range(query);
    return this.insights.dre(req.actor, from, to);
  }
  @Get('crm') @Roles('EMPRESA') @Feature('crm') crm(
    @Req() req: AuthRequest,
    @Query('days') days?: string,
  ) {
    return this.insights.crm(
      req.actor,
      parse(
        z.coerce.number().refine((n) => [15, 30, 60].includes(n)),
        days || '30',
      ),
    );
  }
  @Get('notifications') @Roles('EMPRESA') @Feature('whatsapp') notifications(
    @Req() req: AuthRequest,
  ) {
    return this.insights.notifications(req.actor);
  }
  @Get('blocks') @Roles('EMPRESA') blocks(@Req() req: AuthRequest) {
    return this.appointments.blocks(req.actor);
  }
  @Post('blocks') @Roles('EMPRESA') block(@Req() req: AuthRequest, @Body() body: unknown) {
    const input = parse(
      z.object({ barberId: uuid, startsAt: datetime, endsAt: datetime, reason: name }).strict(),
      body,
    );
    return this.appointments.addBlock(req.actor, input);
  }
  @Delete('blocks/:id') @Roles('EMPRESA') removeBlock(
    @Req() req: AuthRequest,
    @Param('id') id: string,
  ) {
    parse(uuid, id);
    return this.db.transaction(req.actor, async (tx) => {
      const deleted = await tx.scheduleBlock.deleteMany({
        where: { tenantId: req.actor.tenantId, id },
      });
      if (!deleted.count) throw new NotFoundException();
      await audit(tx, req.actor, 'DELETE', 'schedule_blocks', id);
      return { success: true };
    });
  }
  @Get('audit') @Roles('EMPRESA') audit(@Req() req: AuthRequest) {
    return this.db.transaction(req.actor, (tx) =>
      tx.auditLog.findMany({
        where: { tenantId: req.actor.tenantId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );
  }
  @Get('plans') @Roles('MASTER', 'EMPRESA') plans(@Req() req: AuthRequest) {
    return this.db.transaction(req.actor, (tx) =>
      tx.plan.findMany({ orderBy: { priceCents: 'asc' } }),
    );
  }
  @Get('company') @Roles('EMPRESA', 'BARBEIRO', 'CLIENTE') company(@Req() req: AuthRequest) {
    return this.db.transaction(req.actor, (tx) =>
      tx.company.findUnique({ where: { tenantId: req.actor.tenantId }, include: { plan: true } }),
    );
  }
  @Patch('profile') @Roles('CLIENTE') profile(@Req() req: AuthRequest, @Body() body: unknown) {
    const input = parse(schemas.clients.omit({ active: true }).partial(), body);
    return this.db.transaction(req.actor, async (tx) => {
      const result = await tx.client.update({
        where: { tenantId_id: { tenantId: req.actor.tenantId, id: req.actor.clientId! } },
        data: input,
      });
      await audit(tx, req.actor, 'PROFILE', 'clients', result.id);
      return result;
    });
  }
  @Get('business-hours') @Roles('EMPRESA') hours(@Req() req: AuthRequest) {
    return this.db.transaction(req.actor, (tx) =>
      tx.businessHour.findMany({ where: { tenantId: req.actor.tenantId } }),
    );
  }
  @Post('business-hours') @Roles('EMPRESA') setHours(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    const input = parse(
      z
        .object({
          unitId: uuid,
          weekday: z.number().int().min(0).max(6),
          opensAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
          closesAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        })
        .strict(),
      body,
    );
    if (input.closesAt <= input.opensAt)
      throw new BadRequestException('Fim deve ser posterior ao início.');
    return this.db.transaction(req.actor, async (tx) => {
      const row = await tx.businessHour.upsert({
        where: {
          tenantId_unitId_weekday: {
            tenantId: req.actor.tenantId,
            unitId: input.unitId,
            weekday: input.weekday,
          },
        },
        create: { tenantId: req.actor.tenantId, ...input },
        update: input,
      });
      await audit(tx, req.actor, 'HOURS', 'business_hours', row.id);
      return row;
    });
  }
}
@ApiTags('Master')
@ApiBearerAuth()
@Roles('MASTER')
@Controller('master')
export class MasterController {
  constructor(@Inject(MasterService) private master: MasterService) {}
  @Get('metrics') metrics(@Req() req: AuthRequest) {
    return this.master.metrics(req.actor);
  }
  @Get('companies') companies(@Req() req: AuthRequest) {
    return this.master.companies(req.actor);
  }
  @Get('companies/:id/metrics') companyMetrics(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.master.companyMetrics(req.actor, parse(uuid, id));
  }
  @Post('companies') create(@Req() req: AuthRequest, @Body() body: unknown) {
    const input = parse(
      z
        .object({
          name,
          slug: z
            .string()
            .min(2)
            .max(80)
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
          planCode: z.enum(['START', 'PRO', 'PREMIUM', 'ENTERPRISE']),
          admin: z.object({ name, email, password: z.string().min(12).max(128) }),
        })
        .strict(),
      body,
    );
    return this.master.create(req.actor, input);
  }
  @Patch('companies/:id') change(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = parse(
      z
        .object({
          status: z.enum(['ACTIVE', 'SUSPENDED', 'CANCELLED']).optional(),
          planCode: z.enum(['START', 'PRO', 'PREMIUM', 'ENTERPRISE']).optional(),
        })
        .strict(),
      body,
    );
    return this.master.change(req.actor, parse(uuid, id), input);
  }
}
@ApiTags('Relatórios')
@ApiBearerAuth()
@Roles('EMPRESA')
@Feature('reports')
@Controller('reports')
export class ReportsController {
  constructor(@Inject(ReportsService) private reports: ReportsService) {}
  @Get(':kind') async report(
    @Req() req: AuthRequest,
    @Param('kind') kind: string,
    @Query() query: any,
    @Res() res: Response,
  ) {
    parse(
      z.enum(['receita', 'clientes', 'barbeiros', 'servicos', 'comissoes', 'agendamentos']),
      kind,
    );
    const format = parse(z.enum(['pdf', 'xlsx']), query.format || 'pdf'),
      { from, to } = range(query);
    const result = await this.reports.export(req.actor, kind, format, from, to);
    res.setHeader(
      'Content-Type',
      format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="barberhub-${kind}.${format}"`);
    res.send(result);
  }
}
@ApiTags('Arquivos')
@ApiBearerAuth()
@Roles('EMPRESA', 'BARBEIRO', 'CLIENTE')
@Controller('uploads')
export class UploadsController {
  private ensurePersistentStorage() {
    if (process.env.VERCEL === '1')
      throw new ServiceUnavailableException(
        'Uploads precisam de armazenamento persistente configurado para esta hospedagem.',
      );
  }
  private root = resolve(process.env.UPLOAD_DIR || 'uploads');
  constructor(@Inject(Database) private db: Database) {}
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  async upload(@Req() req: AuthRequest, @UploadedFile() file?: Express.Multer.File) {
    this.ensurePersistentStorage();
    if (!file) throw new BadRequestException('Arquivo obrigatório.');
    const b = file.buffer;
    const png =
        b.length > 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      jpeg = b.length > 3 && b[0] === 255 && b[1] === 216 && b[2] === 255,
      pdf = b.subarray(0, 5).toString() === '%PDF-';
    const mime = png ? 'image/png' : jpeg ? 'image/jpeg' : pdf ? 'application/pdf' : null;
    if (!mime) throw new BadRequestException('Apenas PNG, JPEG e PDF são permitidos.');
    const key = `${req.actor.tenantId}/${randomUUID()}.${png ? 'png' : jpeg ? 'jpg' : 'pdf'}`;
    await mkdir(join(this.root, req.actor.tenantId), { recursive: true });
    const path = join(this.root, key);
    await writeFile(path, b, { flag: 'wx' });
    try {
      return await this.db.transaction(req.actor, async (tx) => {
        const row = await tx.upload.create({
          data: {
            tenantId: req.actor.tenantId,
            userId: req.actor.id,
            key,
            mimeType: mime,
            size: file.size,
          },
        });
        await audit(tx, req.actor, 'UPLOAD', 'uploads', row.id);
        return { id: row.id, url: `/api/uploads/${row.id}`, mimeType: mime, size: file.size };
      });
    } catch (e) {
      await unlink(path).catch(() => {});
      throw e;
    }
  }
  @Get(':id') async download(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    this.ensurePersistentStorage();
    const row = await this.db.transaction(req.actor, (tx) =>
      tx.upload.findFirst({
        where: {
          tenantId: req.actor.tenantId,
          id: parse(uuid, id),
          userId: req.actor.role === 'EMPRESA' ? undefined : req.actor.id,
        },
      }),
    );
    if (!row) throw new NotFoundException();
    res.setHeader('Content-Type', row.mimeType);
    res.setHeader('Content-Disposition', 'attachment');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(await readFile(join(this.root, row.key)));
  }
}
