import { TenantRepository } from '../domain/repository';
import {
  Injectable,
  Inject,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Database, audit, lock } from '../infrastructure/database';
import { Actor, appointmentScope, withinLimit } from '../domain/policy';
export type Entity =
  | 'services'
  | 'clients'
  | 'barbers'
  | 'units'
  | 'entries'
  | 'products'
  | 'categories'
  | 'suppliers';
const models = {
  services: 'service',
  clients: 'client',
  barbers: 'barber',
  units: 'unit',
  entries: 'financialEntry',
  products: 'stockProduct',
  categories: 'category',
  suppliers: 'supplier',
} as const;
const feature: Partial<Record<Entity, string>> = {
  entries: 'financial_basic',
  products: 'stock',
  categories: 'financial_basic',
  suppliers: 'stock',
};
@Injectable()
export class CatalogService {
  constructor(@Inject(TenantRepository) private db: TenantRepository) {}
  private async plan(tx: Prisma.TransactionClient, actor: Actor, entity: Entity) {
    const company = await tx.company.findUniqueOrThrow({
      where: { tenantId: actor.tenantId },
      include: { plan: true },
    });
    if (feature[entity] && !company.plan.features.includes(feature[entity]!))
      throw new ForbiddenException('Recurso indisponível no plano.');
    return company.plan;
  }
  async list(actor: Actor, entity: Entity) {
    return this.db.transaction(actor, async (tx) => {
      await this.plan(tx, actor, entity);
      const where: any = { tenantId: actor.tenantId };
      if (entity === 'clients' && actor.role === 'BARBEIRO')
        where.appointments = { some: appointmentScope(actor) };
      if (entity === 'clients' && actor.role === 'CLIENTE') {
        if (!actor.clientId) throw new ForbiddenException('Perfil de cliente não vinculado.');
        where.id = actor.clientId;
      }
      if (entity === 'barbers' && actor.role === 'BARBEIRO') where.id = actor.barberId;
      if (entity === 'barbers' && actor.role === 'CLIENTE')
        return tx.barber.findMany({
          where: { ...where, active: true },
          select: { id: true, name: true, unitId: true, active: true },
        });
      return (tx[models[entity]] as any).findMany({
        where,
        orderBy: entity === 'entries' ? { occurredAt: 'desc' } : { id: 'asc' },
        take: 1000,
      });
    });
  }
  async create(actor: Actor, entity: Entity, data: any) {
    return this.db.transaction(actor, async (tx) => {
      await lock(tx, `limit:${actor.tenantId}:${entity}`);
      const plan = await this.plan(tx, actor, entity);
      const max =
        entity === 'barbers'
          ? plan.maxBarbers
          : entity === 'clients'
            ? plan.maxClients
            : entity === 'units'
              ? plan.maxUnits
              : null;
      const current = await (tx[models[entity]] as any).count({
        where: { tenantId: actor.tenantId },
      });
      if (!withinLimit(current, max)) throw new ForbiddenException('Limite do plano atingido.');
      if (entity === 'products') {
        const initial = data.quantity;
        data = { ...data, quantity: 0 };
        const row = await tx.stockProduct.create({ data: { ...data, tenantId: actor.tenantId } });
        if (initial) {
          await tx.stockProduct.update({ where: { id: row.id }, data: { quantity: initial } });
          await tx.stockMovement.create({
            data: {
              tenantId: actor.tenantId,
              productId: row.id,
              delta: initial,
              reason: 'Estoque inicial',
            },
          });
        }
        await audit(tx, actor, 'CREATE', entity, row.id);
        return { ...row, quantity: initial || 0 };
      }
      const row = await (tx[models[entity]] as any).create({
        data: { ...data, tenantId: actor.tenantId },
      });
      await audit(tx, actor, 'CREATE', entity, row.id);
      return row;
    });
  }
  async update(actor: Actor, entity: Entity, id: string, data: any) {
    return this.db.transaction(actor, async (tx) => {
      await this.plan(tx, actor, entity);
      await lock(tx, `catalog:${actor.tenantId}:${entity}:${id}`);
      const model = tx[models[entity]] as any;
      const row = await model.findFirst({ where: { tenantId: actor.tenantId, id } });
      if (!row) throw new NotFoundException('Registro não encontrado.');
      const updated = await model.update({
        where: { tenantId_id: { tenantId: actor.tenantId, id } },
        data,
      });
      await audit(tx, actor, 'UPDATE', entity, id);
      return updated;
    });
  }
  async stockMove(actor: Actor, id: string, delta: number, reason: string) {
    return this.db.transaction(actor, async (tx) => {
      await this.plan(tx, actor, 'products');
      await lock(tx, `stock:${actor.tenantId}:${id}`);
      const product = await tx.stockProduct.findFirst({ where: { id, tenantId: actor.tenantId } });
      if (!product) throw new NotFoundException();
      if (product.quantity + delta < 0)
        throw new ConflictException('Quantidade insuficiente em estoque.');
      await tx.stockMovement.create({
        data: { tenantId: actor.tenantId, productId: id, delta, reason },
      });
      const result = await tx.stockProduct.update({
        where: { tenantId_id: { tenantId: actor.tenantId, id } },
        data: { quantity: { increment: delta } },
      });
      await audit(tx, actor, 'MOVEMENT', 'stock_products', id, { delta, reason });
      return result;
    });
  }
  async stockHistory(actor: Actor, id: string) {
    return this.db.transaction(actor, (tx) =>
      tx.stockMovement.findMany({
        where: { tenantId: actor.tenantId, productId: id },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      }),
    );
  }
}
