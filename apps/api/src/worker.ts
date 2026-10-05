import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(__dirname, '../../../.env') });
config();
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Database } from './infrastructure/database';
import { NotificationWorker } from './infrastructure/whatsapp';
import { logger } from './http/errors';

@Module({ providers: [Database, NotificationWorker] })
class WorkerModule {}

async function bootstrap() {
  if (process.env.VERCEL === '1')
    throw new Error('Execute o worker em um processo persistente externo.');
  if (!process.env.DATABASE_URL || !process.env.REDIS_URL)
    throw new Error('DATABASE_URL e REDIS_URL obrigatórios.');
  if (!['evolution', 'business'].includes(process.env.WHATSAPP_PROVIDER || ''))
    throw new Error('Configure WHATSAPP_PROVIDER para evolution ou business no worker.');
  process.env.NOTIFICATIONS_MODE = 'embedded';
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  logger.info('Worker BarberHub iniciado sem servidor HTTP.');
}
bootstrap().catch((error) => {
  logger.fatal({ error: error.message }, 'Worker startup failed');
  process.exitCode = 1;
});
