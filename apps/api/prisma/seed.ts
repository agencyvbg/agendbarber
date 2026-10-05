import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { planDefinitions, SYSTEM_TENANT } from '../src/domain/policy';
const prisma = new PrismaClient();
async function main() {
  const password = process.env.SEED_PASSWORD;
  if (!password || password.length < 12)
    throw new Error('Defina SEED_PASSWORD com ao menos 12 caracteres.');
  const passwordHash = await hash(password, 12);
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_master','true',true)`;
      await tx.$executeRaw`SELECT set_config('app.tenant_id',${SYSTEM_TENANT},true)`;
      await tx.tenant.upsert({
        where: { id: SYSTEM_TENANT },
        create: { id: SYSTEM_TENANT, tenantId: SYSTEM_TENANT },
        update: {},
      });
      for (const definition of planDefinitions)
        await tx.plan.upsert({
          where: { code: definition.code },
          create: { ...definition, tenantId: SYSTEM_TENANT },
          update: definition,
        });
      const enterprise = await tx.plan.findUniqueOrThrow({ where: { code: 'ENTERPRISE' } }),
        premium = await tx.plan.findUniqueOrThrow({ where: { code: 'PREMIUM' } });
      await tx.company.upsert({
        where: { slug: 'master' },
        create: {
          tenantId: SYSTEM_TENANT,
          name: 'BarberHub Platform',
          slug: 'master',
          planId: enterprise.id,
          dueAt: new Date('2100-01-01'),
        },
        update: {},
      });
      await tx.user.upsert({
        where: { tenantId_email: { tenantId: SYSTEM_TENANT, email: 'master@barberhub.local' } },
        create: {
          tenantId: SYSTEM_TENANT,
          name: 'Admin Master',
          email: 'master@barberhub.local',
          passwordHash,
          role: 'MASTER',
        },
        update: {},
      });
      for (const [slug, name] of [
        ['studio-original', 'Studio Original'],
        ['barbearia-central', 'Barbearia Central'],
      ]) {
        if (await tx.company.findUnique({ where: { slug } })) continue;
        const tenantId = randomUUID();
        await tx.tenant.create({ data: { id: tenantId, tenantId } });
        await tx.company.create({
          data: {
            tenantId,
            name,
            slug,
            planId: premium.id,
            dueAt: new Date(Date.now() + 30 * 86400000),
          },
        });
        await tx.subscriptionEvent.create({
          data: { tenantId, kind: 'CREATED', nextPlan: 'PREMIUM' },
        });
        await tx.user.create({
          data: {
            tenantId,
            name: 'Gestor da empresa',
            email: 'empresa@barberhub.local',
            passwordHash,
            role: 'EMPRESA',
          },
        });
        const unit = await tx.unit.create({
          data: { tenantId, name: 'Unidade Jardins', address: 'São Paulo, SP' },
        });
        for (let weekday = 0; weekday < 7; weekday++)
          await tx.businessHour.create({
            data: { tenantId, unitId: unit.id, weekday, opensAt: '09:00', closesAt: '19:00' },
          });
        const services = [];
        for (const [name, durationMinutes, priceCents] of [
          ['Corte de cabelo', 30, 5000],
          ['Barba completa', 20, 3500],
          ['Corte + barba', 50, 8000],
          ['Corte degradê', 40, 6500],
        ] as [string, number, number][])
          services.push(
            await tx.service.create({ data: { tenantId, name, durationMinutes, priceCents } }),
          );
        const barbers = [];
        for (const [i, name] of ['Lucas Oliveira', 'Rafael Santos', 'Gabriel Costa'].entries()) {
          const user = await tx.user.create({
            data: {
              tenantId,
              name,
              email: `barbeiro${i + 1}@barberhub.local`,
              passwordHash,
              role: 'BARBEIRO',
            },
          });
          barbers.push(
            await tx.barber.create({
              data: {
                tenantId,
                name,
                userId: user.id,
                unitId: unit.id,
                commissionPercent: 60,
                goalCents: 800000,
              },
            }),
          );
        }
        const clients = [];
        for (const [i, name] of [
          'Pedro Almeida',
          'Matheus Silva',
          'André Ferreira',
          'Bruno Rodrigues',
          'Felipe Martins',
          'Diego Souza',
          'Thiago Lima',
          'Gustavo Pereira',
          'Henrique Alves',
          'João Mendes',
          'Vinícius Rocha',
          'Leonardo Ribeiro',
        ].entries()) {
          const user =
            i === 0
              ? await tx.user.create({
                  data: {
                    tenantId,
                    name,
                    email: 'cliente@barberhub.local',
                    passwordHash,
                    role: 'CLIENTE',
                  },
                })
              : null;
          clients.push(
            await tx.client.create({
              data: {
                tenantId,
                name,
                phone: `119${String(81000000 + i * 10000)}`,
                email: `cliente${i + 1}@exemplo.com`,
                birthDate: new Date('1994-10-10'),
                whatsappConsent: false,
                userId: user?.id,
              },
            }),
          );
        }
        for (let d = 6; d >= 0; d--) {
          for (let i = 0; i < 9; i++) {
            const barber = barbers[i % 3],
              service = services[i % 4],
              client = clients[i % clients.length],
              startsAt = DateTime.now()
                .setZone('America/Sao_Paulo')
                .minus({ days: d })
                .set({ hour: 9 + Math.floor(i / 3) * 2, minute: 0, second: 0, millisecond: 0 }),
              status = d === 0 ? (i < 3 ? 'FINALIZADO' : 'CONFIRMADO') : 'FINALIZADO';
            const appointment = await tx.appointment.create({
              data: {
                tenantId,
                barberId: barber.id,
                clientId: client.id,
                serviceId: service.id,
                unitId: unit.id,
                startsAt: startsAt.toJSDate(),
                endsAt: startsAt.plus({ minutes: service.durationMinutes }).toJSDate(),
                priceCents: service.priceCents,
                commissionPercent: 60,
                status,
              },
            });
            if (status === 'FINALIZADO') {
              const payment = await tx.payment.create({
                data: {
                  tenantId,
                  appointmentId: appointment.id,
                  amountCents: service.priceCents,
                  method: 'PIX',
                  paidAt: startsAt.toJSDate(),
                },
              });
              await tx.financialEntry.create({
                data: {
                  tenantId,
                  paymentId: payment.id,
                  type: 'INCOME',
                  description: `${service.name} · ${client.name}`,
                  amountCents: service.priceCents,
                  method: 'PIX',
                  occurredAt: startsAt.toJSDate(),
                },
              });
              await tx.commission.create({
                data: {
                  tenantId,
                  appointmentId: appointment.id,
                  barberId: barber.id,
                  percent: 60,
                  amountCents: Math.round(service.priceCents * 0.6),
                  createdAt: startsAt.toJSDate(),
                },
              });
            }
          }
        }
        const category = await tx.category.create({
            data: { tenantId, name: 'Produtos para barba', kind: 'STOCK' },
          }),
          supplier = await tx.supplier.create({
            data: { tenantId, name: 'Distribuidora Original', phone: '1133334444' },
          });
        for (const [name, sku, quantity, minimum, costCents, priceCents] of [
          ['Pomada matte · 80g', 'PM-001', 24, 10, 2200, 4500],
          ['Óleo para barba · 30ml', 'OB-002', 4, 8, 1800, 3900],
        ] as [string, string, number, number, number, number][]) {
          const product = await tx.stockProduct.create({
            data: {
              tenantId,
              name,
              sku,
              quantity,
              minimum,
              costCents,
              priceCents,
              categoryId: category.id,
              supplierId: supplier.id,
            },
          });
          await tx.stockMovement.create({
            data: { tenantId, productId: product.id, delta: quantity, reason: 'Estoque inicial' },
          });
        }
        await tx.financialEntry.create({
          data: {
            tenantId,
            type: 'EXPENSE',
            description: 'Aluguel do espaço',
            amountCents: 220000,
            method: 'PIX',
          },
        });
      }
    },
    { timeout: 60000 },
  );
  console.log(
    'Seed concluído. A senha vem exclusivamente de SEED_PASSWORD. Consulte README para os emails de teste.',
  );
}
main().finally(() => prisma.$disconnect());
