import { scheduleCampaigns } from './campaigns';
import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { DateTime } from 'luxon';
import { Database } from './database';
import { systemActor } from '../http/security';
import { logger } from '../http/errors';
export abstract class WhatsAppAdapter {
  abstract send(notification: { kind: string; recipient: string; payload: any }): Promise<void>;
}
export class EvolutionAdapter extends WhatsAppAdapter {
  async send(n: { kind: string; recipient: string; payload: any }) {
    const base = process.env.EVOLUTION_URL,
      instance = process.env.EVOLUTION_INSTANCE,
      key = process.env.EVOLUTION_API_KEY;
    if (!base || !instance || !key) throw new Error('Evolution API não configurada');
    const when = DateTime.fromISO(n.payload.startsAt || new Date().toISOString())
      .setZone(n.payload.timezone || 'America/Sao_Paulo')
      .toFormat('dd/LL HH:mm');
    const text =
      n.kind === 'BIRTHDAY'
        ? `Feliz aniversário, ${n.payload.clientName}! Que seu dia seja especial. Abraços da sua barbearia.`
        : n.kind.startsWith('REACTIVATION')
          ? `Olá, ${n.payload.clientName}! Sentimos sua falta. Que tal reservar seu próximo horário na barbearia?`
          : `Olá, ${n.payload.clientName}! ${n.kind === 'CONFIRMATION' ? 'Seu agendamento está reservado' : 'Lembrando do seu agendamento'}: ${n.payload.serviceName}, ${when}.`;
    const res = await fetch(
      `${base.replace(/\/$/, '')}/message/sendText/${encodeURIComponent(instance)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: key },
        body: JSON.stringify({ number: n.recipient.replace(/\D/g, ''), text }),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!res.ok) throw new Error(`Evolution HTTP ${res.status}`);
  }
}
export class BusinessAdapter extends WhatsAppAdapter {
  async send(n: { kind: string; recipient: string; payload: any }) {
    const token = process.env.WHATSAPP_BUSINESS_TOKEN,
      phoneId = process.env.WHATSAPP_PHONE_ID,
      version = process.env.WHATSAPP_GRAPH_VERSION,
      templates = JSON.parse(process.env.WHATSAPP_TEMPLATES || '{}');
    if (!token || !phoneId || !version || !templates[n.kind])
      throw new Error('WhatsApp Business ou template não configurado');
    const when = DateTime.fromISO(n.payload.startsAt)
      .setZone(n.payload.timezone || 'America/Sao_Paulo')
      .toFormat('dd/LL HH:mm');
    const res = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: n.recipient.replace(/\D/g, ''),
        type: 'template',
        template: {
          name: templates[n.kind],
          language: { code: 'pt_BR' },
          components: [
            {
              type: 'body',
              parameters: (n.kind === 'BIRTHDAY'
                ? [n.payload.clientName]
                : n.kind.startsWith('REACTIVATION')
                  ? [n.payload.clientName, String(n.payload.days)]
                  : [n.payload.clientName, n.payload.serviceName, when]
              ).map((text) => ({ type: 'text', text })),
            },
          ],
        },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`WhatsApp Business HTTP ${res.status}`);
  }
}
@Injectable()
export class NotificationWorker implements OnModuleInit, OnModuleDestroy {
  private queue?: Queue;
  private worker?: Worker;
  private connection?: Redis;
  private timer?: NodeJS.Timeout;
  private campaignTimer?: NodeJS.Timeout;
  private polling = false;
  constructor(@Inject(Database) private db: Database) {}
  async onModuleInit() {
    if (process.env.VERCEL === '1' || process.env.NOTIFICATIONS_MODE === 'external') {
      logger.info('Worker de notificações externo; polling não iniciado nesta API.');
      return;
    }
    const provider = process.env.WHATSAPP_PROVIDER;
    if (!provider || provider === 'disabled') return;
    const adapter =
      provider === 'evolution'
        ? new EvolutionAdapter()
        : provider === 'business'
          ? new BusinessAdapter()
          : null;
    if (!adapter) throw new Error('WHATSAPP_PROVIDER inválido');
    this.connection = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
    this.queue = new Queue('barberhub-notifications', { connection: this.connection });
    this.worker = new Worker(
      'barberhub-notifications',
      async (job) => {
        const n = await this.db.transaction(systemActor, async (tx) => {
          const row = await tx.notification.findUnique({
            where: { id: job.data.id },
            include: { appointment: { include: { client: true } } },
          });
          if (!row || row.status !== 'PENDING') return null;
          const company = await tx.company.findUnique({
            where: { tenantId: row.tenantId },
            include: { plan: true },
          });
          const marketing = row.kind === 'BIRTHDAY' || row.kind.startsWith('REACTIVATION');
          const client = marketing
            ? await tx.client.findFirst({
                where: { tenantId: row.tenantId, id: (row.payload as any).clientId, active: true },
              })
            : row.appointment?.client;
          const appointmentOk =
            marketing ||
            (!!row.appointment && ['AGENDADO', 'CONFIRMADO'].includes(row.appointment.status));
          if (
            company?.status !== 'ACTIVE' ||
            !company.plan.features.includes('whatsapp') ||
            !client?.whatsappConsent ||
            !appointmentOk
          ) {
            await tx.notification.update({ where: { id: row.id }, data: { status: 'CANCELLED' } });
            return null;
          }
          await tx.notification.update({
            where: { id: row.id },
            data: { attempts: { increment: 1 } },
          });
          return row;
        });
        if (!n) return;
        await adapter.send(n);
        await this.db.transaction(systemActor, (tx) =>
          tx.notification.update({
            where: { id: n.id },
            data: { status: 'SENT', sentAt: new Date() },
          }),
        );
      },
      { connection: this.connection, concurrency: 3 },
    );
    this.worker.on('failed', async (job, error) => {
      logger.error(
        { notificationId: job?.data.id, error: error.message },
        'Notification delivery failed',
      );
      if (job && job.attemptsMade >= 5)
        await this.db
          .transaction(systemActor, (tx) =>
            tx.notification.updateMany({
              where: { id: job.data.id, status: 'PENDING' },
              data: { status: 'FAILED' },
            }),
          )
          .catch(() => {});
    });
    const poll = async () => {
      if (this.polling) return;
      this.polling = true;
      try {
        const pending = await this.db.transaction(systemActor, (tx) =>
          tx.notification.findMany({
            where: { status: 'PENDING', dueAt: { lte: new Date(Date.now() + 86400000) } },
            take: 200,
            orderBy: { dueAt: 'asc' },
          }),
        );
        for (const n of pending)
          await this.queue!.add(
            'send',
            { id: n.id },
            {
              jobId: n.id,
              delay: Math.max(0, +n.dueAt - Date.now()),
              attempts: 5,
              backoff: { type: 'exponential', delay: 5000 },
              removeOnComplete: { age: 604800 },
              removeOnFail: false,
            },
          );
      } catch (error) {
        logger.error({ error: String(error) }, 'Outbox polling failed');
      } finally {
        this.polling = false;
      }
    };
    this.timer = setInterval(() => void poll(), 15000);
    const campaigns = () =>
      scheduleCampaigns(this.db).catch((error) =>
        logger.error({ error: String(error) }, 'Campaign scheduling failed'),
      );
    this.campaignTimer = setInterval(() => void campaigns(), 3600000);
    void campaigns().then(() => poll());
    void poll();
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.campaignTimer) clearInterval(this.campaignTimer);
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit();
  }
}
