import { TenantRepository } from '../domain/repository';
import { Injectable, Inject } from '@nestjs/common';
import { Database } from '../infrastructure/database';
import { Actor, appointmentScope } from '../domain/policy';
import { DateTime } from 'luxon';
@Injectable()
export class InsightsService {
  constructor(@Inject(TenantRepository) private db: TenantRepository) {}
  async dashboard(actor: Actor, from: Date, to: Date) {
    return this.db.transaction(actor, async (tx) => {
      const company = await tx.company.findUniqueOrThrow({ where: { tenantId: actor.tenantId } });
      const where = {
        tenantId: actor.tenantId,
        ...appointmentScope(actor),
        startsAt: { gte: from, lte: to },
      };
      const appointments = await tx.appointment.findMany({
        where,
        include: { service: true, barber: true, client: true },
      });
      const completed = appointments.filter((a) => a.status === 'FINALIZADO'),
        revenueCents = completed.reduce((s, a) => s + a.priceCents, 0);
      const serviceTotals = new Map<
          string,
          { name: string; count: number; revenueCents: number }
        >(),
        barberTotals = new Map<string, { name: string; count: number; revenueCents: number }>(),
        daily = new Map<string, { date: string; count: number; revenueCents: number }>();
      for (const a of appointments) {
        const key = DateTime.fromJSDate(a.startsAt, { zone: company.timezone }).toISODate()!;
        const day = daily.get(key) || { date: key, count: 0, revenueCents: 0 };
        day.count++;
        if (a.status === 'FINALIZADO') day.revenueCents += a.priceCents;
        daily.set(key, day);
      }
      for (const a of completed) {
        for (const [map, key, name] of [
          [serviceTotals, a.serviceId, a.service.name],
          [barberTotals, a.barberId, a.barber.name],
        ] as const) {
          const item = map.get(key) || { name, count: 0, revenueCents: 0 };
          item.count++;
          item.revenueCents += a.priceCents;
          map.set(key, item);
        }
      }
      return {
        appointments: appointments.length,
        clientsServed: new Set(completed.map((a) => a.clientId)).size,
        newClients:
          actor.role === 'EMPRESA'
            ? await tx.client.count({
                where: { tenantId: actor.tenantId, createdAt: { gte: from, lte: to } },
              })
            : 0,
        revenueCents,
        averageTicketCents: completed.length ? Math.round(revenueCents / completed.length) : 0,
        daily: [...daily.values()],
        services: [...serviceTotals.values()],
        barbers: [...barberTotals.values()],
      };
    });
  }
  async commissions(actor: Actor, from: Date, to: Date) {
    return this.db.transaction(actor, (tx) =>
      tx.commission.findMany({
        where: {
          tenantId: actor.tenantId,
          barberId: actor.role === 'BARBEIRO' ? actor.barberId : undefined,
          createdAt: { gte: from, lte: to },
        },
        include: { barber: true, appointment: true },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      }),
    );
  }
  async crm(actor: Actor, days: number) {
    return this.db.transaction(actor, async (tx) => {
      const clients = await tx.client.findMany({
        where: { tenantId: actor.tenantId },
        include: {
          appointments: { where: { status: 'FINALIZADO' }, orderBy: { startsAt: 'desc' }, take: 1 },
        },
      });
      return {
        active: clients.filter((c) => c.active),
        inactive: clients.filter((c) => !c.active),
        birthdayMonth: clients.filter(
          (c) => c.birthDate && c.birthDate.getUTCMonth() === new Date().getUTCMonth(),
        ),
        noReturn: clients.filter(
          (c) => !c.appointments[0] || +new Date() - +c.appointments[0].startsAt > days * 86400000,
        ),
      };
    });
  }
  async dre(actor: Actor, from: Date, to: Date) {
    return this.db.transaction(actor, async (tx) => {
      const entries = await tx.financialEntry.findMany({
        where: { tenantId: actor.tenantId, occurredAt: { gte: from, lte: to } },
        include: { category: true },
      });
      const income = entries
          .filter((e) => e.type === 'INCOME')
          .reduce((s, e) => s + e.amountCents, 0),
        expense = entries
          .filter((e) => e.type === 'EXPENSE')
          .reduce((s, e) => s + e.amountCents, 0);
      return {
        basis: 'CASH',
        incomeCents: income,
        expenseCents: expense,
        resultCents: income - expense,
        entries,
      };
    });
  }
  async notifications(actor: Actor) {
    return this.db.transaction(actor, (tx) =>
      tx.notification.findMany({
        where: { tenantId: actor.tenantId },
        orderBy: { dueAt: 'desc' },
        take: 100,
      }),
    );
  }
}
