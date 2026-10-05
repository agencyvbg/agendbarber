import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { TenantRepository } from '../domain/repository';
import { Actor } from '../domain/policy';
@Injectable()
export class Database extends TenantRepository implements OnModuleInit, OnModuleDestroy {
  readonly client = new PrismaClient();
  async onModuleInit() {
    await this.client.$connect();
  }
  async onModuleDestroy() {
    await this.client.$disconnect();
  }
  async transaction<T>(actor: Actor, work: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.client.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${actor.tenantId}, true)`;
        await tx.$executeRaw`SELECT set_config('app.is_master', ${actor.role === 'MASTER' ? 'true' : 'false'}, true)`;
        return work(tx);
      },
      { maxWait: 5000, timeout: 15000 },
    );
  }
}
export async function audit(
  tx: Prisma.TransactionClient,
  actor: Actor,
  action: string,
  resource: string,
  resourceId?: string,
  metadata?: Prisma.InputJsonValue,
) {
  await tx.auditLog.create({
    data: { tenantId: actor.tenantId, actorId: actor.id, action, resource, resourceId, metadata },
  });
}
export async function lock(tx: Prisma.TransactionClient, key: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key},0))`;
}
