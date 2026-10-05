export type Role = 'MASTER' | 'EMPRESA' | 'BARBEIRO' | 'CLIENTE';
export type Status =
  'AGENDADO' | 'CONFIRMADO' | 'EM_ATENDIMENTO' | 'FINALIZADO' | 'CANCELADO' | 'NAO_COMPARECEU';
export const statusLabels: Record<Status, string> = {
  AGENDADO: 'Agendado',
  CONFIRMADO: 'Confirmado',
  EM_ATENDIMENTO: 'Em atendimento',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
  NAO_COMPARECEU: 'Não compareceu',
};
export interface Service {
  id: string;
  name: string;
  description?: string;
  durationMinutes: number;
  priceCents: number;
  active: boolean;
}
export interface Barber {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  commissionPercent: number;
  goalCents: number;
  unitId: string;
  active: boolean;
}
export interface Client {
  id: string;
  name: string;
  email?: string;
  phone: string;
  birthDate?: string;
  whatsappConsent: boolean;
  active: boolean;
  createdAt: string;
}
export interface Appointment {
  id: string;
  barberId: string;
  clientId: string;
  serviceId: string;
  startsAt: string;
  endsAt: string;
  priceCents: number;
  commissionPercent: number;
  status: Status;
  notes?: string;
  barber: Barber;
  client: Client;
  service: Service;
}
export interface Entry {
  id: string;
  description: string;
  type: 'INCOME' | 'EXPENSE';
  amountCents: number;
  method: string;
  occurredAt: string;
}
export interface Product {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  minimum: number;
  priceCents: number;
  costCents: number;
}
export interface Company {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: { code: string; name: string; priceCents: number };
  barbers: number;
  clients: number;
  lastAccessAt: string;
  dueAt: string;
}
export interface Block {
  id: string;
  barberId: string;
  startsAt: string;
  endsAt: string;
  reason: string;
}
export interface Snapshot {
  services: Service[];
  barbers: Barber[];
  clients: Client[];
  appointments: Appointment[];
  entries: Entry[];
  products: Product[];
  companies: Company[];
  metrics?: {
    companies: number;
    barbers: number;
    clients: number;
    appointments: number;
    mrrCents: number;
    arrCents: number;
    churnPercent: number;
    activeCompanies: number;
    cancelledCompanies: number;
  };
  blocks: Block[];
  units: { id: string; name: string }[];
  notifications: { id: string; kind: string; status: string; dueAt: string; recipient: string }[];
}
export const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const iso = (day: string, hour: string) => new Date(`${day}T${hour}:00-03:00`).toISOString();
const services: Service[] = [
  {
    id: 's1',
    name: 'Corte de cabelo',
    description: 'O clássico, do seu jeito.',
    durationMinutes: 30,
    priceCents: 5000,
    active: true,
  },
  {
    id: 's2',
    name: 'Barba completa',
    description: 'Acabamento e toalha quente.',
    durationMinutes: 20,
    priceCents: 3500,
    active: true,
  },
  {
    id: 's3',
    name: 'Corte + barba',
    description: 'Seu visual completo.',
    durationMinutes: 50,
    priceCents: 8000,
    active: true,
  },
  {
    id: 's4',
    name: 'Corte degradê',
    description: 'Precisão em cada detalhe.',
    durationMinutes: 40,
    priceCents: 6500,
    active: true,
  },
  {
    id: 's5',
    name: 'Sobrancelha',
    description: 'Acabamento com navalha.',
    durationMinutes: 15,
    priceCents: 2000,
    active: true,
  },
];
const barbers: Barber[] = [
  {
    id: 'b1',
    name: 'Lucas Oliveira',
    email: 'lucas@demo.barberhub',
    commissionPercent: 60,
    goalCents: 800000,
    unitId: 'u1',
    active: true,
  },
  {
    id: 'b2',
    name: 'Rafael Santos',
    email: 'rafael@demo.barberhub',
    commissionPercent: 55,
    goalCents: 700000,
    unitId: 'u1',
    active: true,
  },
  {
    id: 'b3',
    name: 'Gabriel Costa',
    email: 'gabriel@demo.barberhub',
    commissionPercent: 60,
    goalCents: 650000,
    unitId: 'u1',
    active: true,
  },
];
const names = [
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
  'Caio Barbosa',
  'Daniel Azevedo',
  'Eduardo Ramos',
  'Arthur Teixeira',
  'Vitor Carvalho',
  'Samuel Freitas',
  'Miguel Cardoso',
  'Nicolas Duarte',
  'Alexandre Melo',
  'Davi Gomes',
  'Renan Vieira',
  'Igor Nascimento',
];
const clients: Client[] = names.map((name, i) => ({
  id: `c${i + 1}`,
  name,
  email: `${name.split(' ')[0].toLowerCase()}@exemplo.com`,
  phone: `119${String(81000000 + i * 7147)}`,
  birthDate: `1994-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 25) + 1).padStart(2, '0')}`,
  whatsappConsent: i % 3 !== 0,
  active: true,
  createdAt: new Date(Date.now() - (i % 5) * 86400000).toISOString(),
}));
const appointments: Appointment[] = [];
for (let d = 27; d >= 0; d--) {
  const day = new Date(`${today}T12:00:00-03:00`);
  day.setDate(day.getDate() - d);
  const ds = day.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  for (let i = 0; i < (d === 0 ? 9 : 12); i++) {
    const service = services[(i + d) % 4],
      barber = barbers[i % 3],
      client = clients[(i + d) % clients.length],
      startsAt = iso(
        ds,
        `${String(9 + Math.floor(i / 3) * 2).padStart(2, '0')}:${i % 3 === 0 ? '00' : '30'}`,
      );
    appointments.push({
      id: `a${d}-${i}`,
      barberId: barber.id,
      clientId: client.id,
      serviceId: service.id,
      startsAt,
      endsAt: new Date(
        new Date(startsAt).getTime() + service.durationMinutes * 60000,
      ).toISOString(),
      priceCents: service.priceCents,
      commissionPercent: barber.commissionPercent,
      status: d
        ? 'FINALIZADO'
        : i < 2
          ? 'FINALIZADO'
          : i === 2
            ? 'EM_ATENDIMENTO'
            : i < 6
              ? 'CONFIRMADO'
              : 'AGENDADO',
      barber,
      client,
      service,
    });
  }
}
const entries: Entry[] = appointments
  .filter((a) => a.status === 'FINALIZADO')
  .map((a) => ({
    id: `e${a.id}`,
    description: `${a.service.name} · ${a.client.name}`,
    type: 'INCOME',
    amountCents: a.priceCents,
    method: 'PIX',
    occurredAt: a.startsAt,
  }));
entries.push(
  {
    id: 'exp1',
    description: 'Aluguel do espaço',
    type: 'EXPENSE',
    amountCents: 220000,
    method: 'PIX',
    occurredAt: iso(today, '08:00'),
  },
  {
    id: 'exp2',
    description: 'Produtos e materiais',
    type: 'EXPENSE',
    amountCents: 38500,
    method: 'CREDITO',
    occurredAt: iso(today, '08:10'),
  },
);
export const demo: Snapshot = {
  services,
  barbers,
  clients,
  appointments,
  entries,
  products: [
    {
      id: 'p1',
      name: 'Pomada matte · 80g',
      sku: 'PM-001',
      quantity: 24,
      minimum: 10,
      priceCents: 4500,
      costCents: 2200,
    },
    {
      id: 'p2',
      name: 'Óleo para barba · 30ml',
      sku: 'OB-002',
      quantity: 4,
      minimum: 8,
      priceCents: 3900,
      costCents: 1800,
    },
    {
      id: 'p3',
      name: 'Shampoo masculino · 250ml',
      sku: 'SH-003',
      quantity: 18,
      minimum: 5,
      priceCents: 3200,
      costCents: 1400,
    },
    {
      id: 'p4',
      name: 'Balm pós-barba · 100ml',
      sku: 'BL-004',
      quantity: 3,
      minimum: 5,
      priceCents: 4800,
      costCents: 2400,
    },
  ],
  companies: [
    {
      id: 'co1',
      name: 'Studio Original',
      slug: 'studio-original',
      status: 'ACTIVE',
      plan: { code: 'PREMIUM', name: 'Premium', priceCents: 19900 },
      barbers: 3,
      clients: 24,
      lastAccessAt: iso(today, '08:00'),
      dueAt: iso(today, '12:00'),
    },
    {
      id: 'co2',
      name: 'Barbearia Central',
      slug: 'central',
      status: 'ACTIVE',
      plan: { code: 'PRO', name: 'Pro', priceCents: 9900 },
      barbers: 6,
      clients: 340,
      lastAccessAt: iso(today, '09:00'),
      dueAt: iso(today, '12:00'),
    },
    {
      id: 'co3',
      name: 'Dom Barber',
      slug: 'dom-barber',
      status: 'SUSPENDED',
      plan: { code: 'START', name: 'Start', priceCents: 4900 },
      barbers: 2,
      clients: 128,
      lastAccessAt: iso(today, '07:00'),
      dueAt: iso(today, '12:00'),
    },
  ],
  blocks: [],
  units: [{ id: 'u1', name: 'Unidade Jardins' }],
  notifications: [
    {
      id: 'n1',
      kind: 'Lembrete de agendamento',
      status: 'PENDING',
      dueAt: iso(today, '10:00'),
      recipient: 'Matheus Silva',
    },
    {
      id: 'n2',
      kind: 'Confirmação',
      status: 'SENT',
      dueAt: iso(today, '09:00'),
      recipient: 'Pedro Almeida',
    },
  ],
};
let mode: 'demo' | 'api' = 'demo';
let token = '';
let authFeatures: string[] = [];
let refreshPromise: Promise<void> | null = null;
export const isDemo = () => mode === 'demo';
export const features = () => authFeatures;
async function request(path: string, init: RequestInit = {}, retry = true): Promise<any> {
  const res = await fetch(`/api/${path}`, {
    ...init,
    signal: init.signal || AbortSignal.timeout(15000),
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (res.status === 401 && token && retry) {
    if (!refreshPromise)
      refreshPromise = (async () => {
        const rr = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
        if (!rr.ok) throw new Error('Sessão expirada. Entre novamente.');
        token = (await rr.json()).accessToken;
      })().finally(() => {
        refreshPromise = null;
      });
    await refreshPromise;
    return request(path, init, false);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      Array.isArray(data.message)
        ? data.message.join(', ')
        : data.message || 'Não foi possível concluir a operação.',
    );
  }
  return res.headers.get('content-type')?.includes('json') ? res.json() : res.blob();
}
export type AuthPortal = 'master' | 'team' | 'client';
function acceptSession(result: any) {
  token = result.accessToken;
  mode = 'api';
  authFeatures = result.user.features || [];
  return result.user;
}
export async function login(
  slug: string,
  email: string,
  password: string,
  portal: AuthPortal = 'team',
) {
  const result = await request('auth/login', {
    method: 'POST',
    body: JSON.stringify({ slug, email, password, portal }),
  });
  return acceptSession(result);
}
export async function registerClient(input: {
  slug: string;
  name: string;
  phone: string;
  email: string;
  password: string;
  whatsappConsent: boolean;
}) {
  return acceptSession(
    await request('auth/register', { method: 'POST', body: JSON.stringify(input) }),
  );
}
export async function registerCompany(input: {
  name: string;
  slug: string;
  admin: { name: string; email: string; password: string };
}) {
  return acceptSession(
    await request('auth/register-company', { method: 'POST', body: JSON.stringify(input) }),
  );
}
export async function googleLogin(
  slug: string,
  credential: string,
  portal: AuthPortal,
  registration?: { phone: string; whatsappConsent: boolean },
) {
  return acceptSession(
    await request('auth/google', {
      method: 'POST',
      body: JSON.stringify({ slug, credential, portal, registration }),
    }),
  );
}
export async function linkGoogle(credential: string) {
  return request('auth/google/link', { method: 'POST', body: JSON.stringify({ credential }) });
}
export const googleConfig = () => request('auth/google/config');
let resumePromise: Promise<any> | null = null;
export function restoreSession() {
  if (!resumePromise)
    resumePromise = (async () => {
      const result = await request('auth/refresh', { method: 'POST' }, false);
      token = result.accessToken;
      const user = await request('auth/me');
      return acceptSession({ ...result, user });
    })().catch(() => {
      token = '';
      mode = 'demo';
      return null;
    });
  return resumePromise;
}
export async function logout() {
  try {
    if (mode === 'api') await request('auth/logout', { method: 'POST' });
  } finally {
    token = '';
    mode = 'demo';
    authFeatures = [];
    resumePromise = null;
  }
}
export async function snapshot(role: Role): Promise<Snapshot> {
  if (mode === 'demo') return structuredClone(demo);
  if (role !== 'MASTER') {
    const company = await request('company');
    authFeatures = company.plan.features;
  }
  const paths = [
    'services',
    'barbers',
    'clients',
    'appointments',
    'financial/entries',
    'stock/products',
    'master/companies',
    'blocks',
    'units',
    'notifications',
  ];
  const allowed = [
    role !== 'MASTER',
    role !== 'MASTER',
    role !== 'MASTER',
    role !== 'MASTER',
    role === 'EMPRESA' && authFeatures.includes('financial_basic'),
    role === 'EMPRESA' && authFeatures.includes('stock'),
    role === 'MASTER',
    role === 'EMPRESA',
    role !== 'MASTER',
    role === 'EMPRESA' && authFeatures.includes('whatsapp'),
  ];
  const results = await Promise.all(
    paths.map((p, i) => (allowed[i] ? request(p) : Promise.resolve([]))),
  );
  const metrics = role === 'MASTER' ? await request('master/metrics') : undefined;
  return {
    metrics,
    ...Object.fromEntries(
      [
        'services',
        'barbers',
        'clients',
        'appointments',
        'entries',
        'products',
        'companies',
        'blocks',
        'units',
        'notifications',
      ].map((k, i) => [k, results[i]]),
    ),
  } as unknown as Snapshot;
}
export async function createEntity(
  entity: 'clients' | 'services' | 'barbers' | 'entries' | 'products' | 'units',
  payload: any,
) {
  if (mode === 'api')
    return request(
      ({ entries: 'financial/entries', products: 'stock/products' } as any)[entity] || entity,
      { method: 'POST', body: JSON.stringify(payload) },
    );
  if (entity === 'clients' && demo.clients.some((c) => c.phone === payload.phone))
    throw new Error('Já existe um cliente com esse telefone.');
  const value = {
    id: crypto.randomUUID(),
    active: true,
    createdAt: new Date().toISOString(),
    whatsappConsent: false,
    ...payload,
  };
  (demo[entity] as any[]).push(value);
  return value;
}
export async function availableSlots(barberId: string, serviceId: string, day: string) {
  if (mode === 'api')
    return request(`appointments/slots?barberId=${barberId}&serviceId=${serviceId}&date=${day}`);
  const service = demo.services.find((s) => s.id === serviceId)!;
  const result: string[] = [];
  for (let min = 9 * 60; min + service.durationMinutes <= 19 * 60; min += 15) {
    const start = new Date(
        iso(
          day,
          `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`,
        ),
      ),
      end = new Date(+start + service.durationMinutes * 60000);
    if (start < new Date()) continue;
    if (
      [
        ...demo.appointments.filter(
          (a) => a.barberId === barberId && !['CANCELADO', 'NAO_COMPARECEU'].includes(a.status),
        ),
        ...demo.blocks.filter((b) => b.barberId === barberId),
      ].some((a) => start < new Date(a.endsAt) && end > new Date(a.startsAt))
    )
      continue;
    result.push(start.toISOString());
  }
  return result;
}
export async function saveAppointment(
  payload: { clientId: string; serviceId: string; barberId: string; startsAt: string },
  rescheduleId?: string,
) {
  if (mode === 'api')
    return request(rescheduleId ? `appointments/${rescheduleId}/reschedule` : 'appointments', {
      method: rescheduleId ? 'PATCH' : 'POST',
      body: JSON.stringify(payload),
    });
  const barber = demo.barbers.find((b) => b.id === payload.barberId)!,
    service = demo.services.find((s) => s.id === payload.serviceId)!,
    client = demo.clients.find((c) => c.id === payload.clientId)!;
  const endsAt = new Date(
    new Date(payload.startsAt).getTime() + service.durationMinutes * 60000,
  ).toISOString();
  if (
    [
      ...demo.appointments.filter(
        (a) =>
          a.id !== rescheduleId &&
          a.barberId === barber.id &&
          !['CANCELADO', 'NAO_COMPARECEU'].includes(a.status),
      ),
      ...demo.blocks.filter((b) => b.barberId === barber.id),
    ].some((a) => payload.startsAt < a.endsAt && endsAt > a.startsAt)
  )
    throw new Error('Esse horário já foi reservado. Escolha outro.');
  if (rescheduleId) {
    const a = demo.appointments.find((a) => a.id === rescheduleId)!;
    Object.assign(a, {
      ...payload,
      endsAt,
      barber,
      service,
      client,
      status: 'AGENDADO',
      priceCents: service.priceCents,
      commissionPercent: barber.commissionPercent,
    });
    return a;
  }
  const a: Appointment = {
    id: crypto.randomUUID(),
    ...payload,
    endsAt,
    priceCents: service.priceCents,
    commissionPercent: barber.commissionPercent,
    status: 'AGENDADO',
    barber,
    service,
    client,
  };
  demo.appointments.push(a);
  return a;
}
export async function updateStatus(id: string, status: Status, method = 'PIX') {
  if (mode === 'api')
    return request(`appointments/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, method }),
    });
  const a = demo.appointments.find((a) => a.id === id)!;
  if (status === 'FINALIZADO' && a.status !== 'FINALIZADO')
    demo.entries.push({
      id: crypto.randomUUID(),
      description: `${a.service.name} · ${a.client.name}`,
      amountCents: a.priceCents,
      method,
      occurredAt: new Date().toISOString(),
      type: 'INCOME',
    });
  a.status = status;
}
export async function moveStock(id: string, delta: number, reason: string) {
  if (mode === 'api')
    return request(`stock/products/${id}/movements`, {
      method: 'POST',
      body: JSON.stringify({ delta, reason }),
    });
  const p = demo.products.find((p) => p.id === id)!;
  if (p.quantity + delta < 0) throw new Error('Quantidade insuficiente em estoque.');
  p.quantity += delta;
}
export async function companyChange(id: string, payload: any) {
  if (mode === 'api')
    return request(`master/companies/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  const c = demo.companies.find((c) => c.id === id)!;
  if (payload.status) c.status = payload.status;
  if (payload.planCode)
    c.plan = {
      code: payload.planCode,
      name: payload.planCode,
      priceCents: { START: 4900, PRO: 9900, PREMIUM: 19900, ENTERPRISE: 0 }[
        payload.planCode as 'START'
      ],
    };
}
export async function addBlock(payload: Omit<Block, 'id'>) {
  if (mode === 'api') return request('blocks', { method: 'POST', body: JSON.stringify(payload) });
  if (
    demo.appointments.some(
      (a) =>
        a.barberId === payload.barberId &&
        !['CANCELADO', 'NAO_COMPARECEU'].includes(a.status) &&
        a.startsAt < payload.endsAt &&
        a.endsAt > payload.startsAt,
    )
  )
    throw new Error('O bloqueio conflita com um agendamento existente.');
  demo.blocks.push({ id: crypto.randomUUID(), ...payload });
}
export async function review(id: string, rating: number, comment: string) {
  if (mode === 'api')
    return request(`appointments/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ rating, comment }),
    });
  return { rating, comment };
}
export async function exportReport(kind: string, format: 'pdf' | 'xlsx', from: string, to: string) {
  if (mode === 'api') {
    const blob = await request(`reports/${kind}?format=${format}&from=${from}&to=${to}`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `barberhub-${kind}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  } else if (format === 'pdf') {
    window.print();
  } else {
    const csv =
      '\uFEFFDescrição;Tipo;Valor (R$);Data\r\n' +
      demo.entries
        .filter(
          (e) =>
            e.occurredAt >= new Date(from).toISOString() &&
            e.occurredAt <= new Date(to).toISOString(),
        )
        .map(
          (e) =>
            `"${(/^[=+@-]/.test(e.description) ? "'" : '') + e.description.replace(/"/g, '""')}";${e.type};${(e.amountCents / 100).toFixed(2).replace('.', ',')};${dateLabelForCsv(e.occurredAt)}`,
        )
        .join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'barberhub-financeiro.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
}
function dateLabelForCsv(s: string) {
  return new Date(s).toLocaleDateString('pt-BR');
}

export async function provisionCompany(payload: {
  name: string;
  slug: string;
  planCode: string;
  admin: { name: string; email: string; password: string };
}) {
  if (mode === 'api')
    return request('master/companies', { method: 'POST', body: JSON.stringify(payload) });
  const company: Company = {
    id: crypto.randomUUID(),
    name: payload.name,
    slug: payload.slug,
    status: 'ACTIVE',
    plan: {
      code: payload.planCode,
      name: payload.planCode,
      priceCents: (
        { START: 4900, PRO: 9900, PREMIUM: 19900, ENTERPRISE: 0 } as Record<string, number>
      )[payload.planCode],
    },
    barbers: 0,
    clients: 0,
    lastAccessAt: '',
    dueAt: new Date(Date.now() + 30 * 86400000).toISOString(),
  };
  demo.companies.push(company);
  return company;
}
