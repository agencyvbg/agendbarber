import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
export function parse<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new BadRequestException(
      result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    );
  return result.data;
}
export const uuid = z.string().uuid();
export const cents = z.number().int().min(0).max(100000000);
export const name = z.string().trim().min(2).max(120);
export const email = z
  .string()
  .trim()
  .email()
  .transform((s) => s.toLowerCase());
export const phone = z.string().regex(/^[+0-9 ()-]{10,20}$/);
export const datetime = z.string().datetime({ offset: true });
export const paymentMethod = z.enum(['PIX', 'DINHEIRO', 'CREDITO', 'DEBITO']);
export const status = z.enum([
  'AGENDADO',
  'CONFIRMADO',
  'EM_ATENDIMENTO',
  'FINALIZADO',
  'CANCELADO',
  'NAO_COMPARECEU',
]);
export const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
