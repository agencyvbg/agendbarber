import { UsersController } from './http/users.controller';
import { TenantRepository } from './domain/repository';
import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(__dirname, '../../../.env') });
config();
import { NestFactory } from '@nestjs/core';
import { Module, Controller, Get, Inject } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import { Database } from './infrastructure/database';
import { AccessGuard, RateGuard, Public, systemActor } from './http/security';
import { ErrorFilter, logger } from './http/errors';
import {
  AuthController,
  CatalogController,
  AppointmentsController,
  InsightsController,
  MasterController,
  ReportsController,
  UploadsController,
} from './http/controllers';
import { AuthService } from './application/auth.service';
import { GoogleIdentity } from './infrastructure/google-identity';
import { CatalogService } from './application/catalog.service';
import { AppointmentsService } from './application/appointments.service';
import { InsightsService } from './application/insights.service';
import { MasterService } from './application/master.service';
import { ReportsService } from './application/reports.service';
import { NotificationWorker } from './infrastructure/whatsapp';
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
  throw new Error('JWT_SECRET obrigatório com pelo menos 32 caracteres.');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL obrigatório.');
if (process.env.VERCEL === '1' && !process.env.REDIS_URL)
  throw new Error('REDIS_URL gerenciado obrigatório na Vercel.');
@Controller('health')
class HealthController {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(RateGuard) private rate: RateGuard,
  ) {}
  @Get() @Public() async health() {
    await this.db.transaction(systemActor, (tx) => tx.$queryRaw`SELECT 1`);
    await this.rate.health();
    return { status: 'ok', service: 'barberhub-api' };
  }
}
@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_SECRET })],
  controllers: [
    HealthController,
    AuthController,
    CatalogController,
    AppointmentsController,
    InsightsController,
    MasterController,
    ReportsController,
    UploadsController,
    UsersController,
  ],
  providers: [
    Database,
    { provide: TenantRepository, useExisting: Database },
    AuthService,
    GoogleIdentity,
    CatalogService,
    AppointmentsService,
    InsightsService,
    MasterService,
    ReportsService,
    NotificationWorker,
    RateGuard,
    { provide: APP_GUARD, useExisting: RateGuard },
    { provide: APP_GUARD, useClass: AccessGuard },
  ],
})
class AppModule {}
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  app.enableShutdownHooks();
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: (
      process.env.WEB_ORIGIN ||
      'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174'
    ).split(','),
    credentials: true,
  });
  const express = app.getHttpAdapter().getInstance();
  express.set(
    'trust proxy',
    Number(process.env.PROXY_HOPS) || (process.env.VERCEL === '1' ? 1 : false),
  );
  app.use((req: any, res: any, next: any) => {
    req.requestId = randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    const started = Date.now();
    res.on('finish', () =>
      logger.info(
        {
          requestId: req.requestId,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: Date.now() - started,
        },
        'HTTP',
      ),
    );
    next();
  });
  app.useGlobalFilters(new ErrorFilter());
  if (process.env.ENABLE_SWAGGER === 'true') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('BarberHub API').setVersion('0.1.0').addBearerAuth().build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }
  await app.listen(Number(process.env.PORT) || 3000, '0.0.0.0');
  logger.info({ port: Number(process.env.PORT) || 3000 }, 'BarberHub API ready');
}
bootstrap().catch((error) => {
  logger.fatal({ error: error.message }, 'Startup failed');
  process.exitCode = 1;
});
