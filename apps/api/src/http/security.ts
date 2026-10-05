import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Inject,
  SetMetadata,
  UnauthorizedException,
  ForbiddenException,
  ServiceUnavailableException,
  HttpException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import type { Request } from 'express';
import { Database } from '../infrastructure/database';
import { Actor, Role, SYSTEM_TENANT } from '../domain/policy';
export interface AuthRequest extends Request {
  actor: Actor;
}
export const Public = () => SetMetadata('public', true);
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);
export const Feature = (feature: string) => SetMetadata('feature', feature);
export const systemActor: Actor = { id: SYSTEM_TENANT, tenantId: SYSTEM_TENANT, role: 'MASTER' };
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private reflector: Reflector,
    @Inject(JwtService) private jwt: JwtService,
    @Inject(Database) private db: Database,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    const request = ctx.switchToHttp().getRequest<AuthRequest>();
    if (this.reflector.getAllAndOverride<boolean>('public', [ctx.getHandler(), ctx.getClass()]))
      return true;
    const bearer = request.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!bearer) throw new UnauthorizedException('Autenticação necessária.');
    let claims: any;
    try {
      claims = this.jwt.verify(bearer, {
        algorithms: ['HS256'],
        issuer: 'barberhub',
        audience: 'barberhub-web',
      });
    } catch {
      throw new UnauthorizedException('Sessão expirada.');
    }
    if (typeof claims.sub !== 'string' || typeof claims.tenantId !== 'string')
      throw new UnauthorizedException();
    const actor: Actor = { id: claims.sub, tenantId: claims.tenantId, role: claims.role };
    const identity = await this.db.transaction(actor, async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: actor.id, tenantId: actor.tenantId, active: true },
        include: { barber: true, client: true },
      });
      const company = await tx.company.findUnique({
        where: { tenantId: actor.tenantId },
        include: { plan: true },
      });
      return { user, company };
    });
    if (!identity.user || identity.user.role !== actor.role)
      throw new UnauthorizedException('Conta inativa.');
    if (actor.role === 'MASTER' && actor.tenantId !== SYSTEM_TENANT) throw new ForbiddenException();
    if (actor.role !== 'MASTER' && identity.company?.status !== 'ACTIVE')
      throw new ForbiddenException('Empresa suspensa ou cancelada.');
    actor.barberId = identity.user.barber?.id;
    actor.clientId = identity.user.client?.id;
    if (
      (actor.role === 'BARBEIRO' && (!identity.user.barber || !identity.user.barber.active)) ||
      (actor.role === 'CLIENTE' && (!identity.user.client || !identity.user.client.active))
    )
      throw new ForbiddenException('Perfil não vinculado ou inativo.');
    request.actor = actor;
    const roles = this.reflector.getAllAndOverride<Role[]>('roles', [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (roles && !roles.includes(actor.role)) throw new ForbiddenException('Perfil sem permissão.');
    const feature = this.reflector.getAllAndOverride<string>('feature', [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (feature && !identity.company?.plan.features.includes(feature))
      throw new ForbiddenException('Recurso indisponível no plano contratado.');
    return true;
  }
}
@Injectable()
export class RateGuard implements CanActivate {
  private redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: true,
  });
  constructor() {
    this.redis.on('error', () => {});
    void this.redis.connect().catch(() => {});
  }
  async health() {
    await this.redis.ping();
  }
  async onModuleDestroy() {
    await this.redis.quit().catch(() => this.redis.disconnect());
  }
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (req.path === '/api/health') return true;
    const origins = (
      process.env.WEB_ORIGIN ||
      'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174'
    ).split(',');
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.headers.origin &&
      !origins.includes(req.headers.origin)
    )
      throw new ForbiddenException('Origem não autorizada.');
    const auth = /\/auth\/(login|refresh|register|google)/.test(req.path),
      limit = auth ? 20 : 120;
    try {
      const count = await this.redis.eval(
        "local v=redis.call('INCR',KEYS[1]); if v==1 then redis.call('EXPIRE',KEYS[1],60) end; return v",
        1,
        `rate:${auth ? 'auth' : 'api'}:${req.ip}`,
      );
      if (Number(count) > limit)
        throw new HttpException('Muitas solicitações. Tente novamente em um minuto.', 429);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new ServiceUnavailableException('Proteção de acesso indisponível.');
    }
    return true;
  }
}
