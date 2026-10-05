import { TenantRepository } from '../domain/repository';
import {
  Injectable,
  Inject,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DateTime } from 'luxon';
import { Database, audit, lock } from '../infrastructure/database';
import {
  Actor,
  Status,
  appointmentScope,
  canTransition,
  calculateCommission,
} from '../domain/policy';
const include = { barber: true, client: true, service: true };
const inactive = ['CANCELADO', 'NAO_COMPARECEU'] as const;
export interface Booking {
  clientId: string;
  barberId: string;
  serviceId: string;
  startsAt: string;
}
@Injectable()
export class AppointmentsService {
  constructor(@Inject(TenantRepository) private db: TenantRepository) {}
  async list(actor: Actor, from?: Date, to?: Date) {
    return this.db.transaction(actor, (tx) =>
      tx.appointment.findMany({
        where: {
          tenantId: actor.tenantId,
          ...appointmentScope(actor),
          startsAt: { gte: from, lt: to },
        },
        include,
        orderBy: { startsAt: 'desc' },
        take: 1000,
      }),
    );
  }
  private async scheduling(
    tx: Prisma.TransactionClient,
    actor: Actor,
    barberId: string,
    serviceId: string,
    day: string,
  ) {
    const barber = await tx.barber.findFirst({
        where: { id: barberId, tenantId: actor.tenantId, active: true },
      }),
      service = await tx.service.findFirst({
        where: { id: serviceId, tenantId: actor.tenantId, active: true },
      }),
      company = await tx.company.findUniqueOrThrow({ where: { tenantId: actor.tenantId } });
    if (!barber || !service) throw new NotFoundException('Profissional ou serviço indisponível.');
    if (actor.role === 'BARBEIRO' && barber.id !== actor.barberId)
      throw new ForbiddenException('Agenda de outro profissional.');
    const date = DateTime.fromISO(day, { zone: company.timezone });
    if (!date.isValid) throw new BadRequestException('Data inválida.');
    const hours = await tx.businessHour.findUnique({
      where: {
        tenantId_unitId_weekday: {
          tenantId: actor.tenantId,
          unitId: barber.unitId,
          weekday: date.weekday % 7,
        },
      },
    });
    return { barber, service, company, date, hours };
  }
  async slots(actor: Actor, barberId: string, serviceId: string, day: string) {
    return this.db.transaction(actor, async (tx) => {
      const { date, hours, service } = await this.scheduling(tx, actor, barberId, serviceId, day);
      if (!hours) return [];
      const start = date.startOf('day').toJSDate(),
        end = date.endOf('day').toJSDate();
      const [apps, blocks] = await Promise.all([
        tx.appointment.findMany({
          where: {
            tenantId: actor.tenantId,
            barberId,
            status: { notIn: [...inactive] },
            startsAt: { lt: end },
            endsAt: { gt: start },
          },
        }),
        tx.scheduleBlock.findMany({
          where: {
            tenantId: actor.tenantId,
            barberId,
            startsAt: { lt: end },
            endsAt: { gt: start },
          },
        }),
      ]);
      const opening = date.set({
          hour: Number(hours.opensAt.split(':')[0]),
          minute: Number(hours.opensAt.split(':')[1]),
          second: 0,
          millisecond: 0,
        }),
        closing = date.set({
          hour: Number(hours.closesAt.split(':')[0]),
          minute: Number(hours.closesAt.split(':')[1]),
          second: 0,
          millisecond: 0,
        });
      const result: string[] = [];
      for (
        let s = opening;
        s.plus({ minutes: service.durationMinutes }) <= closing;
        s = s.plus({ minutes: 15 })
      ) {
        const e = s.plus({ minutes: service.durationMinutes });
        if (
          s.toMillis() <= Date.now() ||
          [...apps, ...blocks].some((a) => s.toJSDate() < a.endsAt && e.toJSDate() > a.startsAt)
        )
          continue;
        result.push(s.toUTC().toISO()!);
      }
      return result;
    });
  }
  private async validateBooking(
    tx: Prisma.TransactionClient,
    actor: Actor,
    input: Booking,
    excludeId?: string,
  ) {
    const company = await tx.company.findUniqueOrThrow({ where: { tenantId: actor.tenantId } });
    const start = DateTime.fromISO(input.startsAt).setZone(company.timezone);
    if (!start.isValid || start.toMillis() <= Date.now())
      throw new BadRequestException('Escolha um horário futuro.');
    const { barber, service, hours } = await this.scheduling(
      tx,
      actor,
      input.barberId,
      input.serviceId,
      start.toISODate()!,
    );
    if (!hours) throw new ConflictException('Unidade fechada nesta data.');
    if (start.second !== 0 || start.millisecond !== 0)
      throw new BadRequestException('Horário deve usar minutos completos.');
    const opening = Number(hours.opensAt.split(':')[0]) * 60 + Number(hours.opensAt.split(':')[1]),
      closing = Number(hours.closesAt.split(':')[0]) * 60 + Number(hours.closesAt.split(':')[1]),
      minute = start.hour * 60 + start.minute;
    if (
      minute < opening ||
      minute + service.durationMinutes > closing ||
      (minute - opening) % 15 !== 0
    )
      throw new ConflictException('Horário fora do expediente ou da grade.');
    const client = await tx.client.findFirst({
      where: { id: input.clientId, tenantId: actor.tenantId, active: true },
    });
    if (!client) throw new NotFoundException('Cliente não encontrado.');
    if (actor.role === 'CLIENTE' && client.id !== actor.clientId)
      throw new ForbiddenException('Agendamento de outro cliente.');
    if (
      actor.role === 'BARBEIRO' &&
      !(await tx.appointment.findFirst({
        where: { tenantId: actor.tenantId, barberId: actor.barberId, clientId: client.id },
      }))
    )
      throw new ForbiddenException('Cliente não pertence ao histórico do profissional.');
    const startsAt = start.toJSDate(),
      endsAt = start.plus({ minutes: service.durationMinutes }).toJSDate();
    const where = {
      tenantId: actor.tenantId,
      barberId: barber.id,
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    };
    if (
      (await tx.appointment.findFirst({
        where: {
          ...where,
          id: excludeId ? { not: excludeId } : undefined,
          status: { notIn: [...inactive] },
        },
      })) ||
      (await tx.scheduleBlock.findFirst({ where }))
    )
      throw new ConflictException('Esse horário está ocupado. Escolha outro.');
    return { startsAt, endsAt, barber, service, client };
  }
  private async scheduleNotifications(
    tx: Prisma.TransactionClient,
    actor: Actor,
    appointment: any,
  ) {
    const company = await tx.company.findUniqueOrThrow({
      where: { tenantId: actor.tenantId },
      include: { plan: true },
    });
    if (!company.plan.features.includes('whatsapp') || !appointment.client.whatsappConsent) return;
    const generation = Date.now();
    for (const [kind, dueAt] of [
      ['CONFIRMATION', new Date()],
      ['REMINDER_24H', new Date(+appointment.startsAt - 86400000)],
      ['REMINDER_2H', new Date(+appointment.startsAt - 7200000)],
    ] as [string, Date][]) {
      if (kind !== 'CONFIRMATION' && dueAt < new Date()) continue;
      await tx.notification.create({
        data: {
          tenantId: actor.tenantId,
          appointmentId: appointment.id,
          kind,
          recipient: appointment.client.phone,
          payload: {
            clientName: appointment.client.name,
            serviceName: appointment.service.name,
            startsAt: appointment.startsAt.toISOString(),
            timezone: company.timezone,
          },
          dueAt,
          dedupeKey: `${appointment.id}:${kind}:${generation}`,
        },
      });
    }
  }
  async create(actor: Actor, input: Booking) {
    return this.db.transaction(actor, async (tx) => {
      await lock(tx, `schedule:${actor.tenantId}:${input.barberId}`);
      const { barber, service, startsAt, endsAt } = await this.validateBooking(tx, actor, input);
      const row = await tx.appointment.create({
        data: {
          tenantId: actor.tenantId,
          unitId: barber.unitId,
          barberId: barber.id,
          serviceId: service.id,
          clientId: input.clientId,
          startsAt,
          endsAt,
          priceCents: service.priceCents,
          commissionPercent: barber.commissionPercent,
        },
        include,
      });
      await this.scheduleNotifications(tx, actor, row);
      await audit(tx, actor, 'CREATE', 'appointments', row.id);
      return row;
    });
  }
  async reschedule(actor: Actor, id: string, input: Booking) {
    return this.db.transaction(actor, async (tx) => {
      const initial = await tx.appointment.findFirst({
        where: { tenantId: actor.tenantId, id, ...appointmentScope(actor) },
      });
      if (!initial) throw new NotFoundException();
      for (const bid of [...new Set([initial.barberId, input.barberId])].sort())
        await lock(tx, `schedule:${actor.tenantId}:${bid}`);
      const existing = await tx.appointment.findFirst({
        where: { tenantId: actor.tenantId, id, ...appointmentScope(actor) },
      });
      if (!existing) throw new NotFoundException();
      if (!['AGENDADO', 'CONFIRMADO'].includes(existing.status))
        throw new ConflictException('Este agendamento não pode ser reagendado.');
      if (actor.role === 'CLIENTE' && input.clientId !== existing.clientId)
        throw new ForbiddenException();
      const { barber, service, startsAt, endsAt } = await this.validateBooking(
        tx,
        actor,
        input,
        id,
      );
      await tx.notification.updateMany({
        where: { tenantId: actor.tenantId, appointmentId: id, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      const row = await tx.appointment.update({
        where: { tenantId_id: { tenantId: actor.tenantId, id } },
        data: {
          unitId: barber.unitId,
          barberId: barber.id,
          clientId: input.clientId,
          serviceId: service.id,
          startsAt,
          endsAt,
          priceCents: service.priceCents,
          commissionPercent: barber.commissionPercent,
          status: 'AGENDADO',
        },
        include,
      });
      await this.scheduleNotifications(tx, actor, row);
      await audit(tx, actor, 'RESCHEDULE', 'appointments', id);
      return row;
    });
  }
  async status(
    actor: Actor,
    id: string,
    status: Status,
    method: 'PIX' | 'DINHEIRO' | 'CREDITO' | 'DEBITO',
  ) {
    return this.db.transaction(actor, async (tx) => {
      await lock(tx, `appointment:${actor.tenantId}:${id}`);
      const row = await tx.appointment.findFirst({
        where: { tenantId: actor.tenantId, id, ...appointmentScope(actor) },
        include,
      });
      if (!row) throw new NotFoundException();
      if (row.status === status) return row;
      if (!canTransition(row.status, status, actor.role))
        throw new ConflictException('Transição de status não permitida.');
      if (status === 'FINALIZADO') {
        const company = await tx.company.findUniqueOrThrow({
          where: { tenantId: actor.tenantId },
          include: { plan: true },
        });
        const payment = await tx.payment.create({
          data: {
            tenantId: actor.tenantId,
            appointmentId: id,
            amountCents: row.priceCents,
            method,
          },
        });
        await tx.financialEntry.create({
          data: {
            tenantId: actor.tenantId,
            paymentId: payment.id,
            amountCents: row.priceCents,
            method,
            type: 'INCOME',
            description: `${row.service.name} · ${row.client.name}`,
          },
        });
        if (company.plan.features.includes('commissions'))
          await tx.commission.create({
            data: {
              tenantId: actor.tenantId,
              appointmentId: id,
              barberId: row.barberId,
              percent: row.commissionPercent,
              amountCents: calculateCommission(row.priceCents, row.commissionPercent),
            },
          });
      }
      if (['CANCELADO', 'NAO_COMPARECEU'].includes(status))
        await tx.notification.updateMany({
          where: { tenantId: actor.tenantId, appointmentId: id, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });
      const result = await tx.appointment.update({
        where: { tenantId_id: { tenantId: actor.tenantId, id } },
        data: { status },
        include,
      });
      await audit(tx, actor, 'STATUS', 'appointments', id, { from: row.status, to: status });
      return result;
    });
  }
  async blocks(actor: Actor) {
    return this.db.transaction(actor, (tx) =>
      tx.scheduleBlock.findMany({
        where: { tenantId: actor.tenantId },
        orderBy: { startsAt: 'desc' },
        take: 1000,
      }),
    );
  }
  async addBlock(
    actor: Actor,
    input: { barberId: string; startsAt: string; endsAt: string; reason: string },
  ) {
    return this.db.transaction(actor, async (tx) => {
      await lock(tx, `schedule:${actor.tenantId}:${input.barberId}`);
      const startsAt = new Date(input.startsAt),
        endsAt = new Date(input.endsAt);
      if (endsAt <= startsAt) throw new BadRequestException('Fim deve ser posterior ao início.');
      if (!(await tx.barber.findFirst({ where: { tenantId: actor.tenantId, id: input.barberId } })))
        throw new NotFoundException();
      if (
        await tx.appointment.findFirst({
          where: {
            tenantId: actor.tenantId,
            barberId: input.barberId,
            status: { notIn: [...inactive] },
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
          },
        })
      )
        throw new ConflictException('Bloqueio conflita com atendimento existente.');
      const row = await tx.scheduleBlock.create({
        data: { tenantId: actor.tenantId, ...input, startsAt, endsAt },
      });
      await audit(tx, actor, 'BLOCK', 'schedule_blocks', row.id);
      return row;
    });
  }
  async review(actor: Actor, id: string, rating: number, comment?: string) {
    return this.db.transaction(actor, async (tx) => {
      const app = await tx.appointment.findFirst({
        where: { tenantId: actor.tenantId, id, clientId: actor.clientId, status: 'FINALIZADO' },
      });
      if (!app) throw new NotFoundException('Atendimento finalizado não encontrado.');
      const row = await tx.review.create({
        data: {
          tenantId: actor.tenantId,
          appointmentId: id,
          clientId: actor.clientId!,
          rating,
          comment,
        },
      });
      await audit(tx, actor, 'REVIEW', 'reviews', row.id);
      return row;
    });
  }
}
