import type { Prisma } from '@prisma/client';
import type { Actor } from './policy';
export abstract class TenantRepository {
  abstract transaction<T>(
    actor: Actor,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T>;
}
