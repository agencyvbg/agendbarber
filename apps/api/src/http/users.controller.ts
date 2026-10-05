import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  Req,
  Inject,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { Database, audit } from '../infrastructure/database';
import { AuthRequest, Roles } from './security';
import { parse, uuid, name, email } from './validation';
@ApiTags('Equipe e contas')
@ApiBearerAuth()
@Roles('EMPRESA')
@Controller('users')
export class UsersController {
  constructor(@Inject(Database) private db: Database) {}
  @Get() list(@Req() req: AuthRequest) {
    return this.db.transaction(req.actor, (tx) =>
      tx.user.findMany({
        where: { tenantId: req.actor.tenantId },
        select: { id: true, name: true, email: true, role: true, active: true, lastAccessAt: true },
        take: 1000,
      }),
    );
  }
  @Post() async create(@Req() req: AuthRequest, @Body() body: unknown) {
    const input = parse(
      z
        .object({
          name,
          email,
          password: z.string().min(12).max(128),
          role: z.enum(['EMPRESA', 'BARBEIRO', 'CLIENTE']),
          barberId: uuid.optional(),
          clientId: uuid.optional(),
        })
        .strict(),
      body,
    );
    if (
      (input.role === 'BARBEIRO' && !input.barberId) ||
      (input.role === 'CLIENTE' && !input.clientId)
    )
      throw new ForbiddenException('Vincule a conta a um perfil existente.');
    const passwordHash = await hash(input.password, 12);
    return this.db.transaction(req.actor, async (tx) => {
      if (input.role === 'BARBEIRO') {
        const row = await tx.barber.findFirst({
          where: { tenantId: req.actor.tenantId, id: input.barberId },
        });
        if (!row) throw new NotFoundException();
        if (row.userId) throw new ConflictException('Barbeiro já tem uma conta.');
      }
      if (input.role === 'CLIENTE') {
        const row = await tx.client.findFirst({
          where: { tenantId: req.actor.tenantId, id: input.clientId },
        });
        if (!row) throw new NotFoundException();
        if (row.userId) throw new ConflictException('Cliente já tem uma conta.');
      }
      const user = await tx.user.create({
        data: {
          tenantId: req.actor.tenantId,
          name: input.name,
          email: input.email,
          passwordHash,
          role: input.role,
        },
        select: { id: true, name: true, email: true, role: true },
      });
      if (input.role === 'BARBEIRO')
        await tx.barber.update({
          where: { tenantId_id: { tenantId: req.actor.tenantId, id: input.barberId! } },
          data: { userId: user.id },
        });
      if (input.role === 'CLIENTE')
        await tx.client.update({
          where: { tenantId_id: { tenantId: req.actor.tenantId, id: input.clientId! } },
          data: { userId: user.id },
        });
      await audit(tx, req.actor, 'CREATE_ACCOUNT', 'users', user.id);
      return user;
    });
  }
  @Patch(':id') status(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: unknown) {
    parse(uuid, id);
    if (id === req.actor.id) throw new ForbiddenException('Não desative sua própria conta.');
    const input = parse(z.object({ active: z.boolean() }).strict(), body);
    return this.db.transaction(req.actor, async (tx) => {
      const row = await tx.user.findFirst({ where: { tenantId: req.actor.tenantId, id } });
      if (!row) throw new NotFoundException();
      await tx.user.update({
        where: { tenantId_id: { tenantId: req.actor.tenantId, id } },
        data: input,
      });
      if (!input.active)
        await tx.refreshToken.updateMany({
          where: { tenantId: req.actor.tenantId, userId: id },
          data: { revokedAt: new Date() },
        });
      await audit(tx, req.actor, 'ACCOUNT_STATUS', 'users', id, input);
      return { id, active: input.active };
    });
  }
}
