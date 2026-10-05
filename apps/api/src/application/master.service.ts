import { TenantRepository } from '../domain/repository';
import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { Database, audit, lock } from '../infrastructure/database';
import { Actor, SYSTEM_TENANT } from '../domain/policy';
@Injectable()
export class MasterService {
  constructor(@Inject(TenantRepository) private db: TenantRepository) {}
  async companies(actor: Actor) {
    return this.db.transaction(actor, async (tx) => {
      const rows = await tx.company.findMany({
        where: { tenantId: { not: SYSTEM_TENANT } },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      });
      return Promise.all(
        rows.map(async (c) => ({
          ...c,
          barbers: await tx.barber.count({ where: { tenantId: c.tenantId } }),
          clients: await tx.client.count({ where: { tenantId: c.tenantId } }),
        })),
      );
    });
  }
  async metrics(actor: Actor) {
    return this.db.transaction(actor, async (tx) => {
      const month = new Date();
      month.setUTCDate(1);
      month.setUTCHours(0, 0, 0, 0);
      const companies = await tx.company.findMany({
        where: { tenantId: { not: SYSTEM_TENANT } },
        include: { plan: true },
      });
      const active = companies.filter((c) => c.status === 'ACTIVE'),
        cancelled = companies.filter((c) => c.status === 'CANCELLED'),
        mrr = active.reduce((s, c) => s + (c.plan.priceCents || 0), 0);
      const openingEvents = await tx.subscriptionEvent.findMany({
        where: {
          createdAt: { lt: month },
          kind: { in: ['CREATED', 'ACTIVATED', 'SUSPENDED', 'CANCELLED'] },
        },
        orderBy: { createdAt: 'desc' },
        distinct: ['tenantId'],
      });
      const cohort = new Set(
        openingEvents
          .filter((e) => ['CREATED', 'ACTIVATED'].includes(e.kind))
          .map((e) => e.tenantId),
      );
      const monthlyCancellations = await tx.subscriptionEvent.findMany({
        where: { kind: 'CANCELLED', createdAt: { gte: month } },
        select: { tenantId: true },
      });
      const cancelledMonth = new Set(
        monthlyCancellations.filter((e) => cohort.has(e.tenantId)).map((e) => e.tenantId),
      ).size;
      const opening = cohort.size;
      return {
        companies: companies.length,
        barbers: await tx.barber.count(),
        clients: await tx.client.count(),
        appointments: await tx.appointment.count(),
        mrrCents: mrr,
        arrCents: mrr * 12,
        churnPercent: opening ? (cancelledMonth / opening) * 100 : 0,
        activeCompanies: active.length,
        cancelledCompanies: cancelled.length,
        suspendedCompanies: companies.filter((c) => c.status === 'SUSPENDED').length,
        enterpriseContractsWithoutPrice: active.filter((c) => c.plan.priceCents === null).length,
        churnDefinition:
          'empresas da coorte ativa inicial canceladas no mês / coorte ativa inicial',
        monthStart: month,
      };
    });
  }
  async create(
    actor: Actor,
    input: {
      name: string;
      slug: string;
      planCode: string;
      admin: { name: string; email: string; password: string };
    },
  ) {
    const passwordHash = await hash(input.admin.password, 12);
    return this.db.transaction(actor, async (tx) => {
      const plan = await tx.plan.findUnique({ where: { code: input.planCode } });
      if (!plan) throw new NotFoundException('Plano não encontrado.');
      const tenantId = randomUUID();
      await tx.tenant.create({ data: { id: tenantId, tenantId } });
      const company = await tx.company.create({
        data: {
          tenantId,
          name: input.name,
          slug: input.slug,
          planId: plan.id,
          dueAt: new Date(Date.now() + 30 * 86400000),
        },
      });
      const admin = await tx.user.create({
        data: {
          tenantId,
          name: input.admin.name,
          email: input.admin.email.toLowerCase(),
          passwordHash,
          role: 'EMPRESA',
        },
        select: { id: true, name: true, email: true, role: true },
      });
      const unit = await tx.unit.create({ data: { tenantId, name: 'Unidade principal' } });
      for (let weekday = 1; weekday <= 6; weekday++)
        await tx.businessHour.create({
          data: { tenantId, unitId: unit.id, weekday, opensAt: '09:00', closesAt: '19:00' },
        });
      await tx.subscriptionEvent.create({
        data: { tenantId, kind: 'CREATED', nextPlan: plan.code },
      });
      await audit(tx, actor, 'PROVISION', 'companies', company.id, { tenantId });
      return { company, admin, unit };
    });
  }
  async change(
    actor: Actor,
    id: string,
    input: { status?: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED'; planCode?: string },
  ) {
    return this.db.transaction(actor, async (tx) => {
      await lock(tx, `company:${id}`);
      const company = await tx.company.findUnique({ where: { id }, include: { plan: true } });
      if (!company || company.tenantId === SYSTEM_TENANT) throw new NotFoundException();
      const data: any = {};
      if (input.planCode) {
        const plan = await tx.plan.findUnique({ where: { code: input.planCode } });
        if (!plan) throw new NotFoundException();
        const units = await tx.unit.count({ where: { tenantId: company.tenantId } }),
          barbers = await tx.barber.count({ where: { tenantId: company.tenantId } }),
          clients = await tx.client.count({ where: { tenantId: company.tenantId } });
        if (
          (plan.maxUnits !== null && units > plan.maxUnits) ||
          (plan.maxBarbers !== null && barbers > plan.maxBarbers) ||
          (plan.maxClients !== null && clients > plan.maxClients)
        )
          throw new ForbiddenException('Uso atual excede os limites do plano solicitado.');
        data.planId = plan.id;
        await tx.subscriptionEvent.create({
          data: {
            tenantId: company.tenantId,
            kind: 'PLAN_CHANGED',
            previousPlan: company.plan.code,
            nextPlan: plan.code,
          },
        });
      }
      if (input.status && input.status !== company.status) {
        data.status = input.status;
        data.cancelledAt = input.status === 'CANCELLED' ? new Date() : null;
        await tx.subscriptionEvent.create({
          data: {
            tenantId: company.tenantId,
            kind:
              input.status === 'CANCELLED'
                ? 'CANCELLED'
                : input.status === 'ACTIVE'
                  ? 'ACTIVATED'
                  : 'SUSPENDED',
          },
        });
      }
      const result = await tx.company.update({ where: { id }, data, include: { plan: true } });
      await audit(tx, actor, 'UPDATE', 'companies', id, input);
      return result;
    });
  }
  async companyMetrics(actor: Actor, id: string) {
    return this.db.transaction(actor, async (tx) => {
      const company = await tx.company.findUnique({ where: { id } });
      if (!company || company.tenantId === SYSTEM_TENANT) throw new NotFoundException();
      const tenantId = company.tenantId;
      return {
        barbers: await tx.barber.count({ where: { tenantId } }),
        clients: await tx.client.count({ where: { tenantId } }),
        appointments: await tx.appointment.count({ where: { tenantId } }),
        revenueCents:
          (await tx.payment.aggregate({ where: { tenantId }, _sum: { amountCents: true } }))._sum
            .amountCents || 0,
      };
    });
  }
}
