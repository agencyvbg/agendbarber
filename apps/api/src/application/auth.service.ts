import { TenantRepository } from '../domain/repository';
import {
  Injectable,
  Inject,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { Database, audit, lock } from '../infrastructure/database';
import { systemActor } from '../http/security';
import { Actor, Role } from '../domain/policy';
export type AuthPortal = 'master' | 'team' | 'client';
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
@Injectable()
export class AuthService {
  constructor(
    @Inject(TenantRepository) private db: TenantRepository,
    @Inject(JwtService) private jwt: JwtService,
  ) {}
  private requirePortal(role: Role, portal?: AuthPortal) {
    if (!portal) return;
    const allowed =
      portal === 'master'
        ? ['MASTER']
        : portal === 'client'
          ? ['CLIENTE']
          : ['EMPRESA', 'BARBEIRO'];
    if (!allowed.includes(role))
      throw new ForbiddenException('Esta conta pertence a outra área de acesso.');
  }
  private async session(tx: any, user: any, company: any, action: string) {
    if (!user.active || (user.role !== 'MASTER' && company.status !== 'ACTIVE'))
      throw new ForbiddenException('Conta ou empresa inativa.');
    if (
      (user.role === 'BARBEIRO' && !user.barber?.active) ||
      (user.role === 'CLIENTE' && !user.client?.active)
    )
      throw new ForbiddenException('Perfil não vinculado ou inativo.');
    await tx.user.update({ where: { id: user.id }, data: { lastAccessAt: new Date() } });
    await tx.company.update({ where: { id: company.id }, data: { lastAccessAt: new Date() } });
    const tokens = await this.issue(tx, user, randomUUID());
    await audit(tx, { id: user.id, tenantId: user.tenantId, role: user.role }, action, 'session');
    return { ...tokens, user: this.identity(user, company) };
  }
  private identity(user: any, company: any) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      barberId: user.barber?.id,
      clientId: user.client?.id,
      features: company.plan.features,
      companyName: company.name,
      companySlug: company.slug,
      planCode: company.plan.code,
      googleLinked: !!user.googleSubject,
    };
  }
  async me(actor: Actor) {
    return this.db.transaction(actor, async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: actor.id, tenantId: actor.tenantId },
        include: { barber: true, client: true },
      });
      const company = await tx.company.findUnique({
        where: { tenantId: actor.tenantId },
        include: { plan: true },
      });
      if (!user || !company || !user.active) throw new UnauthorizedException();
      return this.identity(user, company);
    });
  }
  async login(slug: string, email: string, password: string, portal?: AuthPortal) {
    return this.db.transaction(systemActor, async (tx) => {
      const company = await tx.company.findUnique({ where: { slug }, include: { plan: true } });
      if (!company) throw new UnauthorizedException('Empresa, email ou senha inválidos.');
      const user = await tx.user.findUnique({
        where: { tenantId_email: { tenantId: company.tenantId, email: email.toLowerCase() } },
        include: { barber: true, client: true },
      });
      if (!user || !user.active || !(await compare(password, user.passwordHash)))
        throw new UnauthorizedException('Empresa, email ou senha inválidos.');
      this.requirePortal(user.role, portal);
      return this.session(tx, user, company, 'LOGIN');
    });
  }
  async googleLogin(
    slug: string,
    identity: { sub: string; email: string; name: string },
    portal: AuthPortal,
    registration?: { phone: string; whatsappConsent: boolean },
  ) {
    const existing = await this.db.transaction(systemActor, async (tx) => {
      const company = await tx.company.findUnique({ where: { slug }, include: { plan: true } });
      if (!company || company.status !== 'ACTIVE')
        throw new ForbiddenException('Acesso indisponível.');
      const user = await tx.user.findUnique({
        where: {
          tenantId_googleSubject: { tenantId: company.tenantId, googleSubject: identity.sub },
        },
        include: { barber: true, client: true },
      });
      if (user) {
        this.requirePortal(user.role, portal);
        return this.session(tx, user, company, 'GOOGLE_LOGIN');
      }
      if (
        await tx.user.findUnique({
          where: { tenantId_email: { tenantId: company.tenantId, email: identity.email } },
        })
      )
        throw new ConflictException('Entre com sua senha e vincule o Google em Sua conta.');
      return null;
    });
    if (existing) return existing;
    if (portal !== 'client' || !registration)
      throw new ForbiddenException(
        'Conta Google não vinculada. Entre com email e senha para vinculá-la.',
      );
    return this.register({
      slug,
      name: identity.name,
      email: identity.email,
      password: randomBytes(32).toString('base64url'),
      phone: registration.phone,
      whatsappConsent: registration.whatsappConsent,
      googleSubject: identity.sub,
    });
  }
  async linkGoogle(actor: Actor, identity: { sub: string; email: string }) {
    return this.db.transaction(actor, async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: actor.id, tenantId: actor.tenantId, active: true },
      });
      if (!user || user.email !== identity.email)
        throw new ForbiddenException(
          'Use a conta Google com o mesmo email da sua conta BarberHub.',
        );
      if (user.googleSubject && user.googleSubject !== identity.sub)
        throw new ConflictException('Já existe outra conta Google vinculada.');
      await tx.user.update({ where: { id: user.id }, data: { googleSubject: identity.sub } });
      await audit(tx, actor, 'GOOGLE_LINK', 'users', user.id);
      return { success: true };
    });
  }
  async register(input: {
    slug: string;
    name: string;
    phone: string;
    email: string;
    password: string;
    whatsappConsent: boolean;
    googleSubject?: string;
  }) {
    const passwordHash = await hash(input.password, 12);
    await this.db.transaction(systemActor, async (tx) => {
      const company = await tx.company.findUnique({
        where: { slug: input.slug },
        include: { plan: true },
      });
      if (
        !company ||
        company.status !== 'ACTIVE' ||
        !company.plan.features.includes('online_booking')
      )
        throw new ForbiddenException('Cadastro indisponível.');
      await lock(tx, `limit:${company.tenantId}:clients`);
      const count = await tx.client.count({ where: { tenantId: company.tenantId } });
      if (company.plan.maxClients !== null && count >= company.plan.maxClients)
        throw new ForbiddenException('Limite de clientes atingido.');
      const user = await tx.user.create({
        data: {
          tenantId: company.tenantId,
          name: input.name,
          email: input.email.toLowerCase(),
          passwordHash,
          role: 'CLIENTE',
          googleSubject: input.googleSubject,
        },
      });
      await tx.client.create({
        data: {
          tenantId: company.tenantId,
          userId: user.id,
          name: input.name,
          phone: input.phone,
          email: input.email,
          whatsappConsent: input.whatsappConsent,
        },
      });
      await audit(
        tx,
        { id: user.id, tenantId: company.tenantId, role: 'CLIENTE' },
        'REGISTER',
        'users',
        user.id,
      );
    });
    return this.login(input.slug, input.email, input.password);
  }
  private async issue(tx: any, user: any, familyId: string) {
    const refreshToken = randomBytes(48).toString('base64url');
    await tx.refreshToken.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        tokenHash: digest(refreshToken),
        familyId,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    const accessToken = this.jwt.sign(
      { sub: user.id, tenantId: user.tenantId, role: user.role },
      { expiresIn: '15m', issuer: 'barberhub', audience: 'barberhub-web', algorithm: 'HS256' },
    );
    return { accessToken, refreshToken };
  }
  async refresh(raw?: string) {
    if (!raw) throw new UnauthorizedException('Sessão expirada.');
    const outcome = await this.db.transaction(systemActor, async (tx) => {
      const row = await tx.refreshToken.findUnique({
        where: { tokenHash: digest(raw) },
        include: { user: true },
      });
      if (!row) return null;
      if (row.revokedAt) {
        await tx.refreshToken.updateMany({
          where: { familyId: row.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await audit(
          tx,
          { id: row.userId, tenantId: row.tenantId, role: row.user.role },
          'REFRESH_REUSE',
          'session',
        );
        return null;
      }
      const company = await tx.company.findUnique({ where: { tenantId: row.tenantId } });
      if (
        row.expiresAt < new Date() ||
        !row.user.active ||
        (row.user.role !== 'MASTER' && company?.status !== 'ACTIVE')
      )
        return null;
      const changed = await tx.refreshToken.updateMany({
        where: { id: row.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (changed.count !== 1) {
        await tx.refreshToken.updateMany({
          where: { familyId: row.familyId },
          data: { revokedAt: new Date() },
        });
        return null;
      }
      return this.issue(tx, row.user, row.familyId);
    });
    if (!outcome) throw new UnauthorizedException('Sessão inválida. Entre novamente.');
    return outcome;
  }
  async logout(raw?: string) {
    if (raw)
      await this.db.transaction(systemActor, async (tx) => {
        const token = await tx.refreshToken.findUnique({ where: { tokenHash: digest(raw) } });
        if (token)
          await tx.refreshToken.updateMany({
            where: { familyId: token.familyId },
            data: { revokedAt: new Date() },
          });
      });
    return { success: true };
  }
}
