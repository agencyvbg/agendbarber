import { DateTime } from 'luxon';
import { Database } from './database';
import { systemActor } from '../http/security';
// Safe to repeat: unique dedupe keys turn each campaign occurrence into one outbox record.
export async function scheduleCampaigns(db: Database) {
  return db.transaction(systemActor, async (tx) => {
    const companies = await tx.company.findMany({
      where: { status: 'ACTIVE', plan: { features: { has: 'whatsapp' } } },
      take: 500,
    });
    let created = 0;
    for (const company of companies) {
      const now = DateTime.now().setZone(company.timezone),
        clients = await tx.client.findMany({
          where: { tenantId: company.tenantId, active: true, whatsappConsent: true },
          include: {
            appointments: {
              where: { status: 'FINALIZADO' },
              orderBy: { startsAt: 'desc' },
              take: 1,
            },
          },
          take: 1000,
        });
      const rows = [];
      for (const client of clients) {
        const birthday =
          client.birthDate &&
          client.birthDate.getUTCMonth() + 1 === now.month &&
          client.birthDate.getUTCDate() === now.day;
        const last = client.appointments[0]?.startsAt || client.createdAt,
          days = Math.floor(
            now
              .startOf('day')
              .diff(DateTime.fromJSDate(last, { zone: company.timezone }).startOf('day'), 'days')
              .days,
          );
        const common = {
          tenantId: company.tenantId,
          recipient: client.phone,
          status: 'PENDING',
          dueAt: now.set({ hour: 9, minute: 0, second: 0, millisecond: 0 }).toJSDate(),
          payload: { clientId: client.id, clientName: client.name, days },
        };
        if (birthday)
          rows.push({
            ...common,
            kind: 'BIRTHDAY',
            dedupeKey: `birthday:${client.id}:${now.year}`,
          });
        if ([15, 30, 60].includes(days))
          rows.push({
            ...common,
            kind: `REACTIVATION_${days}`,
            dedupeKey: `reactivation:${client.id}:${last.toISOString()}:${days}`,
          });
      }
      if (rows.length)
        created += (await tx.notification.createMany({ data: rows, skipDuplicates: true })).count;
    }
    return created;
  });
}
