import { ReportsService } from '../src/application/reports.service';
import ExcelJS from 'exceljs';
import 'reflect-metadata';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { Database } from '../src/infrastructure/database';
import { AppointmentsService } from '../src/application/appointments.service';
import { CatalogService } from '../src/application/catalog.service';
import { MasterService } from '../src/application/master.service';
import { AuthService } from '../src/application/auth.service';
import { AuthController } from '../src/http/controllers';
import { scheduleCampaigns } from '../src/infrastructure/campaigns';
import { DateTime } from 'luxon';
import { Actor, SYSTEM_TENANT } from '../src/domain/policy';
const enabled = !!process.env.TEST_DATABASE_URL;
if (enabled) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
const db = enabled ? new Database() : null;
const system: Actor = { id: SYSTEM_TENANT, tenantId: SYSTEM_TENANT, role: 'MASTER' };
const additionalTenants: string[] = [];
let a: Actor,
  b: Actor,
  barberId: string,
  clientId: string,
  serviceId: string,
  unitId: string,
  otherClientId: string,
  clientActor: Actor,
  barberActor: Actor,
  createdId: string;
before(async () => {
  if (!db) return;
  await db.onModuleInit();
  const master = new MasterService(db);
  const slug = `qa-${randomUUID().slice(0, 8)}`;
  const first = await master.create(system, {
      name: 'QA Empresa A',
      slug,
      planCode: 'PREMIUM',
      admin: { name: 'Gestor A', email: 'qa@exemplo.com', password: 'Test-Only-Password-2026!' },
    }),
    second = await master.create(system, {
      name: 'QA Empresa B',
      slug: `${slug}-b`,
      planCode: 'START',
      admin: { name: 'Gestor B', email: 'qa@exemplo.com', password: 'Test-Only-Password-2026!' },
    });
  a = { id: first.admin.id, tenantId: first.company.tenantId, role: 'EMPRESA' };
  b = { id: second.admin.id, tenantId: second.company.tenantId, role: 'EMPRESA' };
  unitId = first.unit.id;
  const catalog = new CatalogService(db);
  const barber = await catalog.create(a, 'barbers', {
    name: 'Profissional QA',
    unitId,
    commissionPercent: 60,
    goalCents: 100000,
  });
  barberId = barber.id;
  clientId = (await catalog.create(a, 'clients', { name: 'Cliente A', phone: '11970000001' })).id;
  otherClientId = (await catalog.create(b, 'clients', { name: 'Cliente B', phone: '11970000001' }))
    .id;
  serviceId = (
    await catalog.create(a, 'services', { name: 'Corte QA', durationMinutes: 30, priceCents: 5000 })
  ).id;
  clientActor = { id: randomUUID(), tenantId: a.tenantId, role: 'CLIENTE', clientId };
  barberActor = { id: randomUUID(), tenantId: a.tenantId, role: 'BARBEIRO', barberId };
});
after(async () => {
  if (!db) return;
  if (a)
    await db.transaction(system, async (tx) => {
      const ids = [a.tenantId, b.tenantId, ...additionalTenants];
      for (const model of [
        'review',
        'notification',
        'financialEntry',
        'commission',
        'payment',
        'stockMovement',
        'stockProduct',
        'appointment',
        'scheduleBlock',
        'businessHour',
        'refreshToken',
        'upload',
        'barber',
        'client',
        'service',
        'unit',
        'category',
        'supplier',
        'user',
        'subscriptionEvent',
        'company',
      ] as const)
        await (tx[model] as any).deleteMany({
          where: { tenantId: { in: ids } },
        }); /* Audit is append-only and deliberately retained in this disposable test database. */
    });
  await db.onModuleDestroy();
});
const integration = (name: string, fn: () => Promise<void>) => test(name, { skip: !enabled }, fn);
integration('RLS rejects unscoped reads and isolates tenant clients', async () => {
  assert.equal((await db!.client.client.findMany()).length, 0);
  const ca = await new CatalogService(db!).list(a, 'clients'),
    cb = await new CatalogService(db!).list(b, 'clients');
  assert(ca.every((c: any) => c.tenantId === a.tenantId));
  assert(cb.every((c: any) => c.tenantId === b.tenantId));
  assert.equal(
    ca.some((c: any) => c.id === otherClientId),
    false,
  );
  await assert.rejects(() =>
    new CatalogService(db!).update(a, 'clients', otherClientId, { name: 'Intrusão' }),
  );
});
integration('composite FK rejects foreign client from another tenant', async () => {
  await assert.rejects(() =>
    db!.transaction(a, (tx) =>
      tx.appointment.create({
        data: {
          tenantId: a.tenantId,
          unitId,
          barberId,
          clientId: otherClientId,
          serviceId,
          startsAt: new Date('2030-01-07T12:00Z'),
          endsAt: new Date('2030-01-07T12:30Z'),
          priceCents: 5000,
          commissionPercent: 60,
        },
      }),
    ),
  );
});
integration('concurrent requests reserve a slot exactly once', async () => {
  const app = new AppointmentsService(db!);
  const payload = { clientId, barberId, serviceId, startsAt: '2030-01-07T09:00:00-03:00' };
  const results = await Promise.allSettled([app.create(a, payload), app.create(a, payload)]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  createdId = (results.find((r) => r.status === 'fulfilled') as PromiseFulfilledResult<any>).value
    .id;
});
integration('finalization is idempotent and snapshots commission', async () => {
  const app = new AppointmentsService(db!);
  await app.status(a, createdId, 'EM_ATENDIMENTO', 'PIX');
  await new CatalogService(db!).update(a, 'barbers', barberId, { commissionPercent: 10 });
  await Promise.all([
    app.status(a, createdId, 'FINALIZADO', 'PIX'),
    app.status(a, createdId, 'FINALIZADO', 'PIX'),
  ]);
  await db!.transaction(a, async (tx) => {
    assert.equal(await tx.payment.count({ where: { appointmentId: createdId } }), 1);
    assert.equal(
      await tx.financialEntry.count({ where: { payment: { appointmentId: createdId } } }),
      1,
    );
    const commission = await tx.commission.findUniqueOrThrow({
      where: { appointmentId: createdId },
    });
    assert.equal(commission.amountCents, 3000);
    assert.equal(commission.percent, 60);
  });
});
integration('adjacent intervals are allowed and blocked intervals are unavailable', async () => {
  const app = new AppointmentsService(db!);
  await app.create(a, { clientId, barberId, serviceId, startsAt: '2030-01-07T09:30:00-03:00' });
  await app.addBlock(a, {
    barberId,
    startsAt: '2030-01-07T12:00:00-03:00',
    endsAt: '2030-01-07T13:00:00-03:00',
    reason: 'Almoço',
  });
  await assert.rejects(() =>
    app.create(a, { clientId, barberId, serviceId, startsAt: '2030-01-07T12:00:00-03:00' }),
  );
  const slots = await app.slots(a, barberId, serviceId, '2030-01-07');
  assert(!slots.includes('2030-01-07T15:00:00.000Z'));
});
integration('client cannot mutate another client booking', async () => {
  const c = await new CatalogService(db!).create(a, 'clients', {
      name: 'Outro Cliente',
      phone: '11970000002',
    }),
    app = new AppointmentsService(db!);
  const appointment = await app.create(a, {
    clientId: c.id,
    barberId,
    serviceId,
    startsAt: '2030-01-07T14:00:00-03:00',
  });
  await assert.rejects(() => app.status(clientActor, appointment.id, 'CANCELADO', 'PIX'));
  const clients = await new CatalogService(db!).list(barberActor, 'clients');
  assert(clients.every((x: any) => [clientId, c.id].includes(x.id)));
});
integration('stock cannot become negative under concurrent withdrawals', async () => {
  const catalog = new CatalogService(db!),
    product = await catalog.create(a, 'products', {
      name: 'Produto QA',
      sku: 'QA-01',
      quantity: 1,
      minimum: 1,
      costCents: 100,
      priceCents: 200,
    });
  const results = await Promise.allSettled([
    catalog.stockMove(a, product.id, -1, 'Venda A'),
    catalog.stockMove(a, product.id, -1, 'Venda B'),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const p = await db!.transaction(a, (tx) =>
    tx.stockProduct.findUniqueOrThrow({ where: { id: product.id } }),
  );
  assert.equal(p.quantity, 0);
});
integration('plan barber limit is enforced during simultaneous creation', async () => {
  const unit = await db!.transaction(b, (tx) =>
      tx.unit.findFirstOrThrow({ where: { tenantId: b.tenantId } }),
    ),
    catalog = new CatalogService(db!);
  const results = await Promise.allSettled(
    Array.from({ length: 3 }, (_, i) =>
      catalog.create(b, 'barbers', {
        name: `Barbeiro ${i}`,
        unitId: unit.id,
        commissionPercent: 60,
        goalCents: 10000,
      }),
    ),
  );
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 2);
  await assert.rejects(() =>
    catalog.create(b, 'products', {
      name: 'Produto',
      sku: 'QA',
      quantity: 0,
      minimum: 1,
      costCents: 100,
      priceCents: 200,
    }),
  );
});
integration('refresh rotation rejects reuse and revokes descendants', async () => {
  const slug = await db!.transaction(a, (tx) =>
    tx.company.findUniqueOrThrow({ where: { tenantId: a.tenantId } }),
  );
  const auth = new AuthService(
    db!,
    new JwtService({ secret: 'test-only-secret-with-more-than-32-characters' }),
  );
  const first = await auth.login(slug.slug, 'qa@exemplo.com', 'Test-Only-Password-2026!');
  const next = await auth.refresh(first.refreshToken);
  await assert.rejects(() => auth.refresh(first.refreshToken));
  await assert.rejects(() => auth.refresh(next.refreshToken));
});
integration('public registration creates only a client in the resolved company', async () => {
  const company = await db!.transaction(a, (tx) =>
      tx.company.findUniqueOrThrow({ where: { tenantId: a.tenantId } }),
    ),
    auth = new AuthService(
      db!,
      new JwtService({ secret: 'test-only-secret-with-more-than-32-characters' }),
    );
  const result = await auth.register({
    slug: company.slug,
    name: 'Cadastro público',
    phone: '11970000009',
    email: 'novo@exemplo.com',
    password: 'Test-Only-Password-2026!',
    whatsappConsent: false,
  });
  assert.equal(result.user.role, 'CLIENTE');
  assert.equal(result.user.tenantId, a.tenantId);
  assert(result.user.clientId);
  await assert.rejects(() =>
    auth.register({
      slug: company.slug,
      name: 'Duplicado',
      phone: '11970000009',
      email: 'duplicado@exemplo.com',
      password: 'Test-Only-Password-2026!',
      whatsappConsent: false,
    }),
  );
  await db!.transaction(a, async (tx) =>
    assert.equal(await tx.user.count({ where: { email: 'duplicado@exemplo.com' } }), 0),
  );
});
integration(
  'birthday and reactivation campaigns create one outbox event per occurrence',
  async () => {
    const now = DateTime.now().setZone('America/Sao_Paulo');
    const c = await db!.transaction(a, (tx) =>
      tx.client.create({
        data: {
          tenantId: a.tenantId,
          name: 'Cliente campanha',
          phone: '11970000008',
          whatsappConsent: true,
          birthDate: new Date(
            `1990-${String(now.month).padStart(2, '0')}-${String(now.day).padStart(2, '0')}T00:00:00Z`,
          ),
          createdAt: now.minus({ days: 60 }).toJSDate(),
        },
      }),
    );
    await scheduleCampaigns(db!);
    await scheduleCampaigns(db!);
    const records = await db!.transaction(a, (tx) =>
      tx.notification.findMany({ where: { tenantId: a.tenantId, recipient: c.phone } }),
    );
    assert.equal(records.filter((n) => n.kind === 'BIRTHDAY').length, 1);
    assert.equal(records.filter((n) => n.kind === 'REACTIVATION_60').length, 1);
  },
);

integration('six report formats generate valid PDF and Excel within the tenant', async () => {
  const service = new ReportsService(db!);
  for (const kind of [
    'receita',
    'clientes',
    'barbeiros',
    'servicos',
    'comissoes',
    'agendamentos',
  ]) {
    const from = new Date(Date.now() - 86400000),
      to = new Date(Date.now() + 86400000);
    const pdf = await service.export(a, kind, 'pdf', from, to);
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    const buffer = await service.export(a, kind, 'xlsx', from, to);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(buffer as any);
    assert.equal(book.worksheets.length, 1);
    if (kind === 'clientes') {
      const values = JSON.stringify(book.worksheets[0].getSheetValues());
      assert(values.includes('Cliente A'));
      assert(!values.includes('Cliente B'));
    }
  }
});
integration('missing client link fails closed in catalog use case', async () => {
  await assert.rejects(() =>
    new CatalogService(db!).list(
      { id: randomUUID(), tenantId: a.tenantId, role: 'CLIENTE' },
      'clients',
    ),
  );
});
integration(
  'login rejects the wrong portal and session identity preserves server role',
  async () => {
    const auth = new AuthService(
      db!,
      new JwtService({ secret: 'qa-secret-at-least-32-characters-long' }),
    );
    const company = await db!.transaction(a, (tx) =>
      tx.company.findUniqueOrThrow({ where: { tenantId: a.tenantId } }),
    );
    await assert.rejects(
      () => auth.login(company.slug, 'qa@exemplo.com', 'Test-Only-Password-2026!', 'master'),
      /outra área/,
    );
    await assert.rejects(
      () => auth.login(company.slug, 'qa@exemplo.com', 'Test-Only-Password-2026!', 'client'),
      /outra área/,
    );
    const result = await auth.login(
      company.slug,
      'qa@exemplo.com',
      'Test-Only-Password-2026!',
      'team',
    );
    assert.equal(result.user.role, 'EMPRESA');
    const identity = await auth.me(a);
    assert.equal(identity.tenantId, a.tenantId);
    assert.equal(identity.role, 'EMPRESA');
    assert.equal('passwordHash' in identity, false);
  },
);
integration('Google never links an existing account implicitly or elevates its role', async () => {
  const auth = new AuthService(
    db!,
    new JwtService({ secret: 'qa-secret-at-least-32-characters-long' }),
  );
  const company = await db!.transaction(a, (tx) =>
    tx.company.findUniqueOrThrow({ where: { tenantId: a.tenantId } }),
  );
  const identity = { sub: `google-${randomUUID()}`, email: 'qa@exemplo.com', name: 'Gestor QA' };
  await assert.rejects(() => auth.googleLogin(company.slug, identity, 'team'), /vincule o Google/);
  await assert.rejects(
    () => auth.linkGoogle(a, { ...identity, email: 'outro@exemplo.com' }),
    /mesmo email/,
  );
  await auth.linkGoogle(a, identity);
  const result = await auth.googleLogin(company.slug, identity, 'team');
  assert.equal(result.user.role, 'EMPRESA');
  assert.equal(result.user.googleLinked, true);
  await assert.rejects(() => auth.googleLogin(company.slug, identity, 'master'), /outra área/);
});
integration('Google public signup is client-only and scoped to the selected company', async () => {
  const auth = new AuthService(
    db!,
    new JwtService({ secret: 'qa-secret-at-least-32-characters-long' }),
  );
  const [first, second] = await db!.transaction(system, async (tx) => [
    await tx.company.findUniqueOrThrow({ where: { tenantId: a.tenantId } }),
    await tx.company.findUniqueOrThrow({ where: { tenantId: b.tenantId } }),
  ]);
  const identity = {
    sub: `google-${randomUUID()}`,
    email: 'google-client@exemplo.com',
    name: 'Cliente Google',
  };
  const registration = { phone: '11970000077', whatsappConsent: false };
  await assert.rejects(
    () => auth.googleLogin(first.slug, identity, 'team', registration),
    /não vinculada/,
  );
  const result = await auth.googleLogin(first.slug, identity, 'client', registration);
  assert.equal(result.user.role, 'CLIENTE');
  assert.equal(result.user.tenantId, a.tenantId);
  assert.ok(result.user.clientId);
  const again = await auth.googleLogin(first.slug, identity, 'client');
  assert.equal(again.user.id, result.user.id);
  await assert.rejects(() => auth.googleLogin(second.slug, identity, 'client'), /não vinculada/);
  const actor: Actor = {
    id: result.user.id,
    tenantId: a.tenantId,
    role: 'CLIENTE',
    clientId: result.user.clientId,
  };
  assert.equal((await new CatalogService(db!).list(actor, 'clients')).length, 1);
});
integration('logout revokes the refresh family and prevents session recovery', async () => {
  const auth = new AuthService(
    db!,
    new JwtService({ secret: 'qa-secret-at-least-32-characters-long' }),
  );
  const company = await db!.transaction(a, (tx) =>
    tx.company.findUniqueOrThrow({ where: { tenantId: a.tenantId } }),
  );
  const result = await auth.login(
    company.slug,
    'qa@exemplo.com',
    'Test-Only-Password-2026!',
    'team',
  );
  await auth.logout(result.refreshToken);
  await assert.rejects(() => auth.refresh(result.refreshToken), /inválida/);
});
integration(
  'public company signup provisions START owner and rejects role or plan injection',
  async () => {
    const auth = new AuthService(
      db!,
      new JwtService({ secret: 'qa-secret-at-least-32-characters-long' }),
    );
    const controller = new AuthController(auth, new MasterService(db!), null as any);
    const input = {
      name: 'Nova barbearia QA',
      slug: `signup-${randomUUID().slice(0, 8)}`,
      admin: {
        name: 'Novo gestor',
        email: 'owner@exemplo.com',
        password: 'Test-Only-Password-2026!',
      },
    };
    const cookies: any[] = [];
    const response = { cookie: (...args: any[]) => cookies.push(args) } as any;
    await assert.rejects(() =>
      controller.registerCompany({ ...input, planCode: 'ENTERPRISE' }, response),
    );
    await assert.rejects(() =>
      controller.registerCompany({ ...input, admin: { ...input.admin, role: 'MASTER' } }, response),
    );
    const result = await controller.registerCompany(input, response);
    additionalTenants.push(result.user.tenantId);
    assert.equal(result.user.role, 'EMPRESA');
    assert.equal(result.user.planCode, 'START');
    assert.equal(result.user.companySlug, input.slug);
    assert.equal('refreshToken' in result, false);
    assert.equal(cookies[0][0], 'bh_refresh');
    assert.equal(cookies[0][2].httpOnly, true);
    assert.equal(cookies[0][2].sameSite, 'strict');
    await db!.transaction(system, async (tx) => {
      assert.equal(await tx.unit.count({ where: { tenantId: result.user.tenantId } }), 1);
      assert.equal(
        await tx.user.count({ where: { tenantId: result.user.tenantId, role: 'MASTER' } }),
        0,
      );
    });
  },
);
integration('monthly churn counts a cancelling company once in its starting cohort', async () => {
  const month = new Date();
  month.setUTCDate(1);
  month.setUTCHours(0, 0, 0, 0);
  const company = await db!.transaction(a, (tx) =>
    tx.company.findUniqueOrThrow({ where: { tenantId: a.tenantId } }),
  );
  await db!.transaction(system, (tx) =>
    tx.subscriptionEvent.updateMany({
      where: { tenantId: a.tenantId, kind: 'CREATED' },
      data: { createdAt: new Date(+month - 86400000) },
    }),
  );
  const master = new MasterService(db!);
  await master.change(system, company.id, { status: 'CANCELLED' });
  await master.change(system, company.id, { status: 'ACTIVE' });
  await master.change(system, company.id, { status: 'CANCELLED' });
  const metrics = await master.metrics(system);
  assert.equal(metrics.churnPercent, 100);
});
