export type Role = 'MASTER' | 'EMPRESA' | 'BARBEIRO' | 'CLIENTE';
export type Status =
  'AGENDADO' | 'CONFIRMADO' | 'EM_ATENDIMENTO' | 'FINALIZADO' | 'CANCELADO' | 'NAO_COMPARECEU';
export interface Actor {
  id: string;
  tenantId: string;
  role: Role;
  barberId?: string;
  clientId?: string;
}
export const SYSTEM_TENANT = '00000000-0000-4000-8000-000000000001';
export const planDefinitions = [
  {
    code: 'START',
    name: 'Start',
    priceCents: 4900,
    maxUnits: 1,
    maxBarbers: 2,
    maxClients: 200,
    features: ['agenda', 'clients', 'services', 'online_booking'],
  },
  {
    code: 'PRO',
    name: 'Pro',
    priceCents: 9900,
    maxUnits: 1,
    maxBarbers: 8,
    maxClients: null,
    features: [
      'agenda',
      'clients',
      'services',
      'online_booking',
      'dashboard',
      'whatsapp',
      'commissions',
      'financial_basic',
      'reports',
    ],
  },
  {
    code: 'PREMIUM',
    name: 'Premium',
    priceCents: 19900,
    maxUnits: 3,
    maxBarbers: 25,
    maxClients: null,
    features: [
      'agenda',
      'clients',
      'services',
      'online_booking',
      'dashboard',
      'whatsapp',
      'commissions',
      'financial_basic',
      'reports',
      'multiunit',
      'financial_advanced',
      'stock',
      'crm',
      'goals',
      'executive',
    ],
  },
  {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    priceCents: null,
    maxUnits: null,
    maxBarbers: null,
    maxClients: null,
    features: [
      'agenda',
      'clients',
      'services',
      'online_booking',
      'dashboard',
      'whatsapp',
      'commissions',
      'financial_basic',
      'reports',
      'multiunit',
      'financial_advanced',
      'stock',
      'crm',
      'goals',
      'executive',
      'white_label',
      'api',
      'sla',
    ],
  },
];
export function canTransition(from: Status, to: Status, role: Role) {
  if (from === to) return true;
  const transitions: Record<Status, Status[]> = {
    AGENDADO: ['CONFIRMADO', 'EM_ATENDIMENTO', 'CANCELADO', 'NAO_COMPARECEU'],
    CONFIRMADO: ['EM_ATENDIMENTO', 'CANCELADO', 'NAO_COMPARECEU'],
    EM_ATENDIMENTO: ['FINALIZADO'],
    FINALIZADO: [],
    CANCELADO: [],
    NAO_COMPARECEU: [],
  };
  if (role === 'CLIENTE') return ['AGENDADO', 'CONFIRMADO'].includes(from) && to === 'CANCELADO';
  return ['EMPRESA', 'BARBEIRO'].includes(role) && transitions[from].includes(to);
}
export function overlaps(a: { startsAt: Date; endsAt: Date }, b: { startsAt: Date; endsAt: Date }) {
  return a.startsAt < b.endsAt && a.endsAt > b.startsAt;
}
export function calculateCommission(cents: number, percent: number) {
  if (
    !Number.isInteger(cents) ||
    cents < 0 ||
    !Number.isInteger(percent) ||
    percent < 0 ||
    percent > 100
  )
    throw new Error('Invalid money or commission');
  return Math.round((cents * percent) / 100);
}
export function appointmentScope(actor: Actor) {
  if (actor.role === 'BARBEIRO') {
    if (!actor.barberId) throw new Error('Barber identity missing');
    return { barberId: actor.barberId };
  }
  if (actor.role === 'CLIENTE') {
    if (!actor.clientId) throw new Error('Client identity missing');
    return { clientId: actor.clientId };
  }
  if (actor.role === 'EMPRESA') return {};
  throw new Error('Tenant scope unavailable for master');
}
export function withinLimit(current: number, max: number | null) {
  return max === null || current < max;
}
