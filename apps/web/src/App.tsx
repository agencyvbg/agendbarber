import { AuthPage } from './pages/AuthPage';
import { GoogleButton } from './components/GoogleButton';
import { Avatar, Badge, Empty, Field, Select, Kpi } from './components/shared';
import { useEffect, useState, useRef, lazy, Suspense, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Scissors,
  LayoutDashboard,
  CalendarDays,
  Users,
  UserRound,
  Wallet,
  Package,
  HeartHandshake,
  BarChart3,
  MessageCircle,
  Settings,
  ChevronDown,
  Plus,
  Search,
  Bell,
  Sun,
  Moon,
  ChevronRight,
  ChevronLeft,
  ArrowUpRight,
  ArrowDownRight,
  Clock3,
  Check,
  MoreHorizontal,
  Download,
  Building2,
  Crown,
  CircleHelp,
  Menu,
  X,
  Target,
  Banknote,
  Sparkles,
  LogIn,
  LogOut,
  ShieldCheck,
  Star,
  Mail,
  Phone,
  CircleCheck,
  TrendingUp,
  Filter,
} from 'lucide-react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/card';
import { Dialog } from './components/ui/dialog';
import { cn, money, initials, timeLabel, dateLabel } from './lib/utils';
import {
  snapshot,
  today,
  isDemo,
  features,
  restoreSession,
  linkGoogle,
  logout,
  createEntity,
  saveAppointment,
  availableSlots,
  updateStatus,
  moveStock,
  companyChange,
  provisionCompany,
  addBlock,
  review,
  exportReport,
  statusLabels,
  type Role,
  type Status,
  type Snapshot,
  type Appointment,
} from './lib/data';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const navigation = [
  { id: 'dashboard', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'agenda', label: 'Agenda', icon: CalendarDays },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'barbeiros', label: 'Barbeiros', icon: Scissors },
  { id: 'servicos', label: 'Serviços', icon: Sparkles },
  { id: 'financeiro', label: 'Financeiro', icon: Wallet },
  { id: 'comissoes', label: 'Comissões', icon: Banknote },
  { id: 'estoque', label: 'Estoque', icon: Package },
  { id: 'crm', label: 'Relacionamento', icon: HeartHandshake },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
  { id: 'empresas', label: 'Empresas', icon: Building2 },
  { id: 'planos', label: 'Planos e assinatura', icon: Crown },
  { id: 'configuracoes', label: 'Configurações', icon: Settings },
];
const rolePages: Record<Role, string[]> = {
  MASTER: ['dashboard', 'empresas', 'planos', 'configuracoes'],
  EMPRESA: navigation.filter((n) => n.id !== 'empresas').map((n) => n.id),
  BARBEIRO: ['dashboard', 'agenda', 'clientes', 'comissoes', 'configuracoes'],
  CLIENTE: ['dashboard', 'agenda', 'configuracoes'],
};
const formSchema = z.object({
  name: z.string().min(2, 'Informe pelo menos 2 caracteres.'),
  phone: z.string().optional(),
  email: z.union([z.string().email('Email inválido.'), z.literal('')]).optional(),
  cost: z.coerce.number().nonnegative().optional(),
  price: z.coerce.number().nonnegative().optional(),
  duration: z.coerce.number().int().min(5).max(480).optional(),
  commission: z.coerce.number().min(0).max(100).optional(),
  description: z.string().optional(),
  quantity: z.coerce.number().int().nonnegative().optional(),
  minimum: z.coerce.number().int().nonnegative().optional(),
  sku: z.string().optional(),
  type: z.string().optional(),
  method: z.string().optional(),
  birthDate: z.string().optional(),
  consent: z.boolean().optional(),
});
type FormValues = z.infer<typeof formSchema>;
const colors = ['#9c7bff', '#7255cc', '#b99cff', '#57436f', '#d5c4ff'];

export default function App() {
  const qc = useQueryClient();
  const [page, setPage] = useState(location.hash.slice(1) || 'dashboard');
  const [access, setAccess] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [role, setRole] = useState<Role>('EMPRESA');
  const [user, setUser] = useState<{
    name: string;
    email?: string;
    googleLinked?: boolean;
    companySlug?: string;
    role: Role;
    barberId?: string;
    clientId?: string;
    companyName?: string;
    planCode?: string;
  } | null>(null);
  const [theme, setTheme] = useState(localStorage.getItem('barberhub-theme') || 'dark');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [mobile, setMobile] = useState(false);
  const [compactSidebar, setCompactSidebar] = useState(
    () => window.matchMedia('(max-width: 980px)').matches,
  );
  const sidebarRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 980px)');
    const update = () => {
      setCompactSidebar(media.matches);
      setMobile(false);
    };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!mobile || !compactSidebar) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const items = () =>
      Array.from(
        sidebarRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input',
        ) || [],
      );
    items()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobile(false);
      }
      if (event.key !== 'Tab') return;
      const elements = items();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', keydown);
      previousFocus?.focus();
    };
  }, [mobile, compactSidebar]);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('Mês');
  const [day, setDay] = useState(today);
  const [barberFilter, setBarberFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialog, setDialog] = useState('');
  useEffect(() => {
    if (dialog) setMobile(false);
  }, [dialog]);
  const [reschedule, setReschedule] = useState<Appointment | null>(null);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [saving, setSaving] = useState(false);
  const [slot, setSlot] = useState('');
  const [booking, setBooking] = useState({
    clientId: '',
    barberId: '',
    serviceId: '',
    date: today,
  });
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [crmDays, setCrmDays] = useState('30');
  const [stockId, setStockId] = useState('');
  const [stockDelta, setStockDelta] = useState('1');
  const [stockReason, setStockReason] = useState('Reposição');
  const [blockEnd, setBlockEnd] = useState('13:00');
  const [blockStart, setBlockStart] = useState('12:00');
  const [blockReason, setBlockReason] = useState('Almoço');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [newCompany, setNewCompany] = useState({
    name: '',
    slug: '',
    planCode: 'START',
    admin: { name: '', email: '', password: '' },
  });
  const [blockEndDay, setBlockEndDay] = useState('');
  const [apiMode, setApiMode] = useState(false);
  const [reportKind, setReportKind] = useState('receita');
  const acceptSession = (identity: NonNullable<typeof user>) => {
    setUser(identity);
    setRole(identity.role);
    setSelectedUnit('');
    setApiMode(true);
    setAccess(true);
    setPage('dashboard');
    setDialog('');
    qc.clear();
  };
  useEffect(() => {
    let active = true;
    void restoreSession().then((identity) => {
      if (!active) return;
      if (identity) acceptSession(identity);
      setRestoring(false);
    });
    return () => {
      active = false;
    };
  }, []);
  const signOut = async () => {
    setSaving(true);
    try {
      await logout();
    } catch {
      toast.error('Você saiu neste navegador. Não foi possível confirmar a revogação no servidor.');
    } finally {
      setUser(null);
      setApiMode(false);
      setAccess(false);
      setDialog('');
      setPage('dashboard');
      setSelectedUnit('');
      setMobile(false);
      qc.clear();
      setSaving(false);
    }
  };

  const {
    data: allData,
    error,
    isLoading,
  } = useQuery({
    queryKey: ['snapshot', role, apiMode],
    queryFn: () => snapshot(role),
    enabled: access && !restoring,
  });
  const data = allData
    ? {
        ...allData,
        barbers: allData.barbers.filter((b) => !selectedUnit || b.unitId === selectedUnit),
        appointments: allData.appointments.filter(
          (a) => !selectedUnit || a.barber.unitId === selectedUnit,
        ),
      }
    : undefined;
  const featureFor: Record<string, string> = {
    dashboard: 'dashboard',
    financeiro: 'financial_basic',
    comissoes: 'commissions',
    estoque: 'stock',
    crm: 'crm',
    whatsapp: 'whatsapp',
    relatorios: 'reports',
  };
  const allowedPages = rolePages[role].filter(
    (p) =>
      isDemo() ||
      role === 'MASTER' ||
      role === 'CLIENTE' ||
      !featureFor[p] ||
      features().includes(featureFor[p]),
  );
  const displayName =
    user?.name ||
    (role === 'CLIENTE'
      ? data?.clients[0]?.name || 'Cliente'
      : role === 'MASTER'
        ? 'Admin Master'
        : 'Lucas Oliveira');
  const workspaceName = role === 'MASTER' ? 'BarberHub' : user?.companyName || 'Studio Original';
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      price: 50,
      duration: 30,
      commission: 60,
      quantity: 0,
      minimum: 5,
      type: 'INCOME',
      method: 'PIX',
      consent: false,
    },
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('barberhub-theme', theme);
  }, [theme]);
  useEffect(() => {
    const handler = () => setPage(location.hash.slice(1) || 'dashboard');
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  const go = (id: string) => {
    setPage(id);
    location.hash = id;
    setMobile(false);
    setSearch('');
  };
  useEffect(() => {
    if (!allowedPages.includes(page)) go(allowedPages[0] || 'agenda');
  }, [role, page, apiMode, features().join(',')]);
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['snapshot'] });
    await qc.invalidateQueries({ queryKey: ['slots'] });
  };
  const run = async (fn: () => Promise<unknown>, message: string, close = true) => {
    setSaving(true);
    try {
      await fn();
      await refresh();
      toast.success(message);
      if (close) {
        setDialog('');
        setSelected(null);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ocorreu um erro.');
    } finally {
      setSaving(false);
    }
  };
  const openForm = (kind: string) => {
    form.reset({
      name: '',
      email: '',
      price: kind === 'entries' ? 100 : 50,
      duration: 30,
      commission: 60,
      quantity: 0,
      minimum: 5,
      type: 'INCOME',
      method: 'PIX',
      consent: false,
    });
    setDialog(kind);
  };
  const ownBarber = user?.barberId || data?.barbers[0]?.id;
  const ownClient = user?.clientId || data?.clients[0]?.id;
  const visibleAppointments = (data?.appointments || []).filter((a) =>
    role === 'BARBEIRO'
      ? a.barberId === ownBarber
      : role === 'CLIENTE'
        ? a.clientId === ownClient
        : true,
  );
  const clients = (data?.clients || []).filter((c) =>
    role === 'BARBEIRO'
      ? visibleAppointments.some((a) => a.clientId === c.id)
      : role === 'CLIENTE'
        ? c.id === ownClient
        : true,
  );
  const initialBooking = (appointment?: Appointment) => {
    setReschedule(appointment || null);
    setBooking({
      clientId:
        appointment?.clientId ||
        (role === 'CLIENTE' ? ownClient || '' : data?.clients[0]?.id || ''),
      barberId:
        appointment?.barberId ||
        (role === 'BARBEIRO' ? ownBarber || '' : data?.barbers[0]?.id || ''),
      serviceId: appointment?.serviceId || data?.services[0]?.id || '',
      date: appointment?.startsAt.slice(0, 10) || day,
    });
    setSlot('');
    setDialog('appointment');
  };
  const slots = useQuery({
    queryKey: ['slots', booking.barberId, booking.serviceId, booking.date],
    queryFn: () => availableSlots(booking.barberId, booking.serviceId, booking.date),
    enabled: dialog === 'appointment' && !!booking.barberId && !!booking.serviceId,
  });
  const from = new Date(`${today}T00:00:00-03:00`);
  if (period === 'Semana') from.setDate(from.getDate() - 6);
  if (period === 'Mês') from.setDate(1);
  const filtered = visibleAppointments.filter(
    (a) =>
      new Date(a.startsAt) >= from && new Date(a.startsAt) <= new Date(`${today}T23:59:59-03:00`),
  );
  const completed = filtered.filter((a) => a.status === 'FINALIZADO');
  const revenue = completed.reduce((s, a) => s + a.priceCents, 0);
  const matches = (name: string) => name.toLowerCase().includes(search.toLowerCase());
  const chartData = Array.from(
    {
      length:
        period === 'Hoje' ? 12 : period === 'Semana' ? 7 : new Date(`${today}T12:00:00`).getDate(),
    },
    (_, i) => {
      const d = new Date(from);
      if (period === 'Hoje') {
        d.setHours(i + 8);
      } else d.setDate(d.getDate() + i);
      const key = d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      return {
        name: period === 'Hoje' ? `${i + 8}h` : String(d.getDate()).padStart(2, '0'),
        value:
          completed
            .filter(
              (a) =>
                new Date(a.startsAt).toLocaleDateString('en-CA', {
                  timeZone: 'America/Sao_Paulo',
                }) === key &&
                (period !== 'Hoje' || new Date(a.startsAt).getHours() === d.getHours()),
            )
            .reduce((s, a) => s + a.priceCents, 0) / 100,
      };
    },
  );
  const serviceData = (data?.services || [])
    .map((s) => ({ name: s.name, value: completed.filter((a) => a.serviceId === s.id).length }))
    .filter((s) => s.value > 0);
  const dayAppointments = visibleAppointments
    .filter(
      (a) =>
        new Date(a.startsAt).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) === day,
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const activeToday = dayAppointments.filter((a) => a.status !== 'CANCELADO');

  const appointmentTable = (rows: Appointment[], compact = false) => (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Serviço</th>
            <th>Barbeiro</th>
            <th>Horário</th>
            <th>Status</th>
            {!compact && <th>Valor</th>}
            <th>
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows
            .filter((a) => matches(a.client.name) || matches(a.service.name))
            .map((a, i) => (
              <tr key={a.id}>
                <td>
                  <div className="person">
                    <Avatar name={a.client.name} index={i} />
                    <div>
                      <b>{a.client.name}</b>
                      {!compact && <small>{a.client.phone}</small>}
                    </div>
                  </div>
                </td>
                <td>{a.service.name}</td>
                <td>
                  <span className="barber-cell">
                    <span
                      className={`mini-dot dot-${(data?.barbers.findIndex((b) => b.id === a.barberId) || 0) % 3}`}
                    />
                    {a.barber.name.split(' ')[0]}
                  </span>
                </td>
                <td>
                  <span className="time-cell">
                    <Clock3 size={13} />
                    {timeLabel(a.startsAt)}
                  </span>
                </td>
                <td>
                  <Badge status={a.status} />
                </td>
                {!compact && <td>{money(a.priceCents)}</td>}
                <td>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Detalhes de ${a.client.name}`}
                    onClick={() => {
                      setSelected(a);
                      setDialog('detail');
                    }}
                  >
                    <MoreHorizontal size={18} />
                  </Button>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      {!rows.length && <Empty>Nenhum agendamento para este filtro.</Empty>}
    </div>
  );

  const companyDashboard = () => (
    <Dashboard
      data={data}
      role={role}
      ownBarber={ownBarber}
      period={period}
      revenue={revenue}
      completed={completed}
      clients={clients}
      from={from}
      chartData={chartData}
      serviceData={serviceData}
      activeToday={activeToday}
      day={day}
      go={go}
      appointmentTable={appointmentTable}
    />
  );

  const masterDashboard = () => {
    const companies = data?.companies || [],
      active = companies.filter((c) => c.status === 'ACTIVE'),
      mrr = active.reduce((s, c) => s + (c.plan.priceCents || 0), 0);
    return (
      <>
        <div className="stats-grid">
          <Kpi title="Empresas ativas" value={String(active.length)} icon={Building2} />
          <Kpi title="MRR" value={money(mrr)} icon={Wallet} />
          <Kpi title="ARR projetado" value={money(mrr * 12)} icon={TrendingUp} />
          <Kpi
            title="Empresas canceladas"
            value={String(companies.filter((c) => c.status === 'CANCELLED').length)}
            icon={Users}
          />
        </div>
        <div className="stats-grid mt-5">
          <Kpi
            title="Barbeiros"
            value={String(companies.reduce((s, c) => s + c.barbers, 0))}
            icon={Scissors}
          />
          <Kpi
            title="Clientes cadastrados"
            value={String(companies.reduce((s, c) => s + c.clients, 0))}
            icon={Users}
          />
          <Kpi
            title="Empresas suspensas"
            value={String(companies.filter((c) => c.status === 'SUSPENDED').length)}
            icon={ShieldCheck}
          />
          <Kpi title="Empresas cadastradas" value={String(companies.length)} icon={Building2} />
        </div>
        <div className="stats-grid three mt-5">
          <Kpi
            title="Agendamentos na plataforma"
            value={String(data?.metrics?.appointments || data?.appointments.length || 0)}
            icon={CalendarDays}
          />
          <Kpi
            title="Churn do mês"
            value={`${(data?.metrics?.churnPercent || 0).toFixed(1)}%`}
            icon={TrendingUp}
          />
          <Kpi
            title="Assinaturas canceladas"
            value={String(
              data?.metrics?.cancelledCompanies ||
                companies.filter((c) => c.status === 'CANCELLED').length,
            )}
            icon={Users}
          />
        </div>
        <div className="notice mt-5">
          <BarChart3 size={18} />
          <p>
            MRR considera assinaturas ativas com preço conhecido. ARR é a projeção de 12 meses.
            Churn representa cancelamentos no mês em relação às empresas existentes no início do
            período.
          </p>
        </div>
        {companiesTable()}
      </>
    );
  };
  const companiesTable = () => (
    <Card className="mt-5">
      <CardHeader>
        <CardTitle>Empresas da plataforma</CardTitle>
        <Button onClick={() => setDialog('company-create')}>
          <Plus size={16} />
          Nova empresa
        </Button>
      </CardHeader>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Plano</th>
              <th>Status</th>
              <th>Equipe / clientes</th>
              <th>Último acesso</th>
              <th>Vencimento</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {data?.companies
              .filter((c) => matches(c.name))
              .map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="person">
                      <span className="unit-icon">
                        <Scissors size={17} />
                      </span>
                      <b>{c.name}</b>
                    </div>
                  </td>
                  <td>
                    <Select
                      value={c.plan.code}
                      aria-label={`Plano de ${c.name}`}
                      onChange={(e) =>
                        run(
                          () => companyChange(c.id, { planCode: e.target.value }),
                          'Plano atualizado.',
                          false,
                        )
                      }
                    >
                      {['START', 'PRO', 'PREMIUM', 'ENTERPRISE'].map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </Select>
                  </td>
                  <td>
                    <Badge status={c.status} />
                  </td>
                  <td>
                    {c.barbers} / {c.clients}
                  </td>
                  <td>{c.lastAccessAt ? dateLabel(c.lastAccessAt) : 'Sem acesso'}</td>
                  <td>{dateLabel(c.dueAt)}</td>
                  <td>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        run(
                          () =>
                            companyChange(c.id, {
                              status: c.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
                            }),
                          'Status atualizado.',
                          false,
                        )
                      }
                    >
                      {c.status === 'ACTIVE' ? 'Suspender' : 'Ativar'}
                    </Button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </Card>
  );

  const screen = () => {
    if (!data) return null;
    if (page === 'dashboard') {
      if (role === 'MASTER') return masterDashboard();
      if (role === 'CLIENTE') {
        const next = visibleAppointments
          .filter(
            (a) =>
              !['FINALIZADO', 'CANCELADO', 'NAO_COMPARECEU'].includes(a.status) &&
              new Date(a.startsAt) >= new Date(),
          )
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
        return (
          <>
            <Card className="client-welcome">
              <div>
                <span className="eyebrow">SEU PRÓXIMO MOMENTO</span>
                <h2>{next ? next.service.name : 'Um novo visual espera por você.'}</h2>
                <p>
                  {next
                    ? `${dateLabel(next.startsAt)} às ${timeLabel(next.startsAt)} · ${next.barber.name}`
                    : 'Escolha um serviço e encontre o melhor horário.'}
                </p>
                <Button onClick={() => initialBooking()}>
                  <Plus size={16} />
                  Agendar horário
                </Button>
              </div>
              <Scissors size={70} />
            </Card>
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Seus agendamentos</CardTitle>
              </CardHeader>
              {appointmentTable(visibleAppointments.slice().reverse())}
            </Card>
          </>
        );
      }
      return (
        <>
          {role === 'BARBEIRO' && (
            <div className="personal-banner">
              <Target size={21} />
              <span>
                Meta mensal:{' '}
                <b>{money(data.barbers.find((b) => b.id === ownBarber)?.goalCents || 0)}</b>
              </span>
              <span>
                Comissões do período:{' '}
                <b>
                  {money(
                    completed.reduce(
                      (s, a) => s + Math.round((a.priceCents * a.commissionPercent) / 100),
                      0,
                    ),
                  )}
                </b>
              </span>
            </div>
          )}
          {companyDashboard()}
        </>
      );
    }
    if (page === 'agenda')
      return (
        <>
          <div className="toolbar">
            <div className="date-navigator">
              <Button
                size="icon"
                variant="ghost"
                aria-label="Dia anterior"
                onClick={() => {
                  const d = new Date(`${day}T12:00:00`);
                  d.setDate(d.getDate() - 1);
                  setDay(d.toLocaleDateString('en-CA'));
                }}
              >
                <ChevronLeft size={17} />
              </Button>
              <Input
                aria-label="Dia da agenda"
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
              <Button
                size="icon"
                variant="ghost"
                aria-label="Próximo dia"
                onClick={() => {
                  const d = new Date(`${day}T12:00:00`);
                  d.setDate(d.getDate() + 1);
                  setDay(d.toLocaleDateString('en-CA'));
                }}
              >
                <ChevronRight size={17} />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDay(today)}>
                Hoje
              </Button>
            </div>
            <div className="flex gap-2">
              <Select
                aria-label="Filtrar por barbeiro"
                value={barberFilter}
                onChange={(e) => setBarberFilter(e.target.value)}
              >
                <option value="all">Todos os barbeiros</option>
                {data.barbers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Filtrar por status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Todos os status</option>
                {Object.entries(statusLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
              {role === 'EMPRESA' && (
                <Button variant="outline" onClick={() => setDialog('block')}>
                  <Clock3 size={16} />
                  Bloquear
                </Button>
              )}
            </div>
          </div>
          <div className="agenda-summary">
            <span>
              <span className="mini-dot dot-0" />
              {activeToday.length} agendamentos
            </span>
            <span>
              <Clock3 size={14} />
              {Math.round(
                activeToday.reduce(
                  (s, a) => s + (+new Date(a.endsAt) - +new Date(a.startsAt)) / 60000,
                  0,
                ) / 60,
              )}
              h reservadas
            </span>
            <span>
              <Wallet size={14} />
              {money(activeToday.reduce((s, a) => s + a.priceCents, 0))} em serviços
            </span>
          </div>
          <Card>
            {appointmentTable(
              dayAppointments.filter(
                (a) =>
                  (barberFilter === 'all' || a.barberId === barberFilter) &&
                  (statusFilter === 'all' || a.status === statusFilter) &&
                  matches(a.client.name),
              ),
            )}
          </Card>
          {data.blocks.length > 0 && (
            <Card className="mt-5">
              <CardHeader>
                <CardTitle>Bloqueios cadastrados</CardTitle>
              </CardHeader>
              <CardContent>
                {data.blocks.map((b) => (
                  <p key={b.id} className="py-2 text-sm">
                    {data.barbers.find((x) => x.id === b.barberId)?.name} · {dateLabel(b.startsAt)}{' '}
                    · {timeLabel(b.startsAt)}–{timeLabel(b.endsAt)} · {b.reason}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      );
    if (page === 'clientes')
      return (
        <Card>
          <CardHeader>
            <CardTitle>{clients.length} clientes</CardTitle>
            {role === 'EMPRESA' && (
              <Button onClick={() => openForm('clients')}>
                <Plus size={16} />
                Novo cliente
              </Button>
            )}
          </CardHeader>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Contato</th>
                  <th>Última visita</th>
                  <th>Atendimentos</th>
                  <th>Total gasto</th>
                  <th>WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {clients
                  .filter((c) => matches(c.name) || matches(c.phone))
                  .map((c, i) => {
                    const history = visibleAppointments
                      .filter((a) => a.clientId === c.id && a.status === 'FINALIZADO')
                      .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
                    return (
                      <tr key={c.id}>
                        <td>
                          <div className="person">
                            <Avatar name={c.name} index={i} />
                            <div>
                              <b>{c.name}</b>
                              <small>{c.email || 'Email não informado'}</small>
                            </div>
                          </div>
                        </td>
                        <td>{c.phone}</td>
                        <td>{history[0] ? dateLabel(history[0].startsAt) : 'Primeira visita'}</td>
                        <td>{history.length}</td>
                        <td>{money(history.reduce((s, a) => s + a.priceCents, 0))}</td>
                        <td>
                          <span className={c.whatsappConsent ? 'text-emerald-400' : 'muted'}>
                            {c.whatsappConsent ? 'Autorizado' : 'Sem consentimento'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Card>
      );
    if (page === 'barbeiros')
      return (
        <>
          <div className="toolbar">
            <span className="muted text-sm">{data.barbers.length} profissionais na equipe</span>
            <Button onClick={() => openForm('barbers')}>
              <Plus size={16} />
              Adicionar barbeiro
            </Button>
          </div>
          <div className="people-grid">
            {data.barbers
              .filter((b) => matches(b.name))
              .map((b, i) => {
                const apps = filtered.filter(
                  (a) => a.barberId === b.id && a.status === 'FINALIZADO',
                );
                return (
                  <Card key={b.id} className="barber-card">
                    <Avatar name={b.name} index={i} size="large" />
                    <h2>{b.name}</h2>
                    <p>{b.email}</p>
                    <span className="status status-active">Ativo</span>
                    <div className="barber-numbers">
                      <div>
                        <b>{apps.length}</b>
                        <small>Atendimentos</small>
                      </div>
                      <div>
                        <b>{b.commissionPercent}%</b>
                        <small>Comissão</small>
                      </div>
                    </div>
                    <div className="barber-goal">
                      <span>Meta do mês</span>
                      <b>{money(b.goalCents)}</b>
                    </div>
                    <div className="progress">
                      <span
                        style={{
                          width: `${Math.min(100, (apps.reduce((s, a) => s + a.priceCents, 0) / b.goalCents) * 100)}%`,
                        }}
                      />
                    </div>
                    <Button
                      className="w-full mt-5"
                      variant="outline"
                      onClick={() => {
                        setBarberFilter(b.id);
                        go('agenda');
                      }}
                    >
                      <CalendarDays size={15} />
                      Ver agenda
                    </Button>
                  </Card>
                );
              })}
          </div>
        </>
      );
    if (page === 'servicos')
      return (
        <>
          <div className="toolbar">
            <span className="muted text-sm">Um bom atendimento começa com a escolha certa.</span>
            <Button onClick={() => openForm('services')}>
              <Plus size={16} />
              Novo serviço
            </Button>
          </div>
          <div className="service-grid">
            {data.services
              .filter((s) => matches(s.name))
              .map((s, i) => (
                <Card key={s.id} className="service-card">
                  <div className="service-card-top">
                    <span className={`service-icon avatar-${i}`}>
                      <Scissors size={22} />
                    </span>
                    <Badge status={s.active ? 'ACTIVE' : 'SUSPENDED'} />
                  </div>
                  <h2>{s.name}</h2>
                  <p>{s.description}</p>
                  <div className="service-card-bottom">
                    <span>
                      <Clock3 size={15} />
                      {s.durationMinutes} min
                    </span>
                    <strong>{money(s.priceCents)}</strong>
                  </div>
                  <Button
                    className="w-full mt-5"
                    variant="outline"
                    onClick={() => {
                      initialBooking();
                      setBooking((b) => ({ ...b, serviceId: s.id }));
                    }}
                  >
                    Agendar serviço
                  </Button>
                </Card>
              ))}
          </div>
        </>
      );
    if (page === 'financeiro') {
      const es = data.entries.filter((e) => new Date(e.occurredAt) >= from),
        income = es.filter((e) => e.type === 'INCOME').reduce((s, e) => s + e.amountCents, 0),
        expense = es.filter((e) => e.type === 'EXPENSE').reduce((s, e) => s + e.amountCents, 0);
      return (
        <>
          <div className="stats-grid three">
            <Kpi title="Entradas" value={money(income)} icon={ArrowDownRight} />
            <Kpi title="Saídas" value={money(expense)} icon={ArrowUpRight} />
            <Kpi title="Saldo do período" value={money(income - expense)} icon={Wallet} />
          </div>
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Fluxo de caixa</CardTitle>
              <Button onClick={() => openForm('entries')}>
                <Plus size={16} />
                Novo lançamento
              </Button>
            </CardHeader>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Descrição</th>
                    <th>Tipo</th>
                    <th>Pagamento</th>
                    <th>Data</th>
                    <th className="text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {es
                    .filter((e) => matches(e.description))
                    .slice()
                    .reverse()
                    .slice(0, 100)
                    .map((e) => (
                      <tr key={e.id}>
                        <td>{e.description}</td>
                        <td>
                          <Badge status={e.type} />
                        </td>
                        <td>{e.method}</td>
                        <td>{dateLabel(e.occurredAt)}</td>
                        <td
                          className={cn(
                            'text-right font-medium',
                            e.type === 'INCOME' ? 'text-emerald-400' : 'text-red-400',
                          )}
                        >
                          {e.type === 'EXPENSE' ? '-' : '+'} {money(e.amountCents)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card className="mt-5">
            <CardHeader>
              <CardTitle>Demonstrativo gerencial · regime de caixa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="dre-row">
                <span>Receita de serviços e outras entradas</span>
                <b>{money(income)}</b>
              </div>
              <div className="dre-row">
                <span>Saídas registradas</span>
                <b>{money(expense)}</b>
              </div>
              <div className="dre-row">
                <span>Resultado de caixa</span>
                <b>{money(income - expense)}</b>
              </div>
              <p className="card-caption mt-3">
                DRE contábil por competência e classificação fiscal estão previstas no roadmap.
              </p>
            </CardContent>
          </Card>
        </>
      );
    }
    if (page === 'comissoes') {
      const team = data.barbers.filter((b) => role !== 'BARBEIRO' || b.id === ownBarber);
      return (
        <>
          <div className="stats-grid three">
            {['Hoje', 'Semana', 'Mês'].map((p) => {
              const start = new Date(`${today}T00:00:00-03:00`);
              if (p === 'Semana') start.setDate(start.getDate() - 6);
              if (p === 'Mês') start.setDate(1);
              return (
                <Kpi
                  key={p}
                  title={`Comissões · ${p.toLowerCase()}`}
                  icon={Banknote}
                  value={money(
                    visibleAppointments
                      .filter((a) => a.status === 'FINALIZADO' && new Date(a.startsAt) >= start)
                      .reduce(
                        (s, a) => s + Math.round((a.priceCents * a.commissionPercent) / 100),
                        0,
                      ),
                  )}
                />
              );
            })}
          </div>
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Comissões por profissional</CardTitle>
            </CardHeader>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Barbeiro</th>
                    <th>Percentual atual</th>
                    <th>Atendimentos</th>
                    <th>Receita do período</th>
                    <th>Comissão gerada</th>
                  </tr>
                </thead>
                <tbody>
                  {team.map((b, i) => {
                    const apps = completed.filter((a) => a.barberId === b.id);
                    return (
                      <tr key={b.id}>
                        <td>
                          <div className="person">
                            <Avatar name={b.name} index={i} />
                            <b>{b.name}</b>
                          </div>
                        </td>
                        <td>{b.commissionPercent}%</td>
                        <td>{apps.length}</td>
                        <td>{money(apps.reduce((s, a) => s + a.priceCents, 0))}</td>
                        <td className="text-primary font-semibold">
                          {money(
                            apps.reduce(
                              (s, a) => s + Math.round((a.priceCents * a.commissionPercent) / 100),
                              0,
                            ),
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <div className="notice mt-5">
            <ShieldCheck size={18} />
            <p>
              Os percentuais são preservados em cada agendamento. A comissão é gerada quando o
              atendimento é finalizado.
            </p>
          </div>
        </>
      );
    }
    if (page === 'estoque')
      return (
        <>
          <div className="stats-grid three">
            <Kpi title="Produtos cadastrados" value={String(data.products.length)} icon={Package} />
            <Kpi
              title="Valor em estoque · custo"
              value={money(data.products.reduce((s, p) => s + p.quantity * p.costCents, 0))}
              icon={Wallet}
            />
            <Kpi
              title="Abaixo do mínimo"
              value={String(data.products.filter((p) => p.quantity < p.minimum).length)}
              icon={Bell}
            />
          </div>
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Produtos e estoque</CardTitle>
              <Button onClick={() => openForm('products')}>
                <Plus size={16} />
                Novo produto
              </Button>
            </CardHeader>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>SKU</th>
                    <th>Estoque</th>
                    <th>Mínimo</th>
                    <th>Preço</th>
                    <th>Situação</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.products
                    .filter((p) => matches(p.name))
                    .map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div className="person">
                            <span className="unit-icon">
                              <Package size={17} />
                            </span>
                            <b>{p.name}</b>
                          </div>
                        </td>
                        <td className="muted">{p.sku}</td>
                        <td>{p.quantity} un.</td>
                        <td>{p.minimum} un.</td>
                        <td>{money(p.priceCents)}</td>
                        <td>
                          <span
                            className={cn(
                              'status',
                              p.quantity < p.minimum ? 'status-agendado' : 'status-confirmado',
                            )}
                          >
                            {p.quantity < p.minimum ? 'Estoque baixo' : 'Em estoque'}
                          </span>
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setStockId(p.id);
                              setDialog('stock');
                            }}
                          >
                            Movimentar
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      );
    if (page === 'crm') {
      const inactive = clients.filter((c) => {
          const last = visibleAppointments
            .filter((a) => a.clientId === c.id && a.status === 'FINALIZADO')
            .sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0];
          return (
            !last || Date.now() - new Date(last.startsAt).getTime() > Number(crmDays) * 86400000
          );
        }),
        birthdays = clients.filter(
          (c) =>
            c.birthDate && new Date(c.birthDate + 'T12:00:00').getMonth() === new Date().getMonth(),
        );
      return (
        <>
          <div className="stats-grid three">
            <Kpi
              title="Clientes ativos"
              value={String(clients.length - inactive.length)}
              icon={Users}
            />
            <Kpi
              title={`Sem retornar · ${crmDays} dias`}
              value={String(inactive.length)}
              icon={HeartHandshake}
            />
            <Kpi title="Aniversariantes do mês" value={String(birthdays.length)} icon={Star} />
          </div>
          <Card className="mt-6">
            <CardHeader>
              <div>
                <CardTitle>É hora de se reconectar</CardTitle>
                <p className="card-caption">
                  Clientes que podem estar sentindo falta do seu cuidado
                </p>
              </div>
              <Select
                value={crmDays}
                onChange={(e) => setCrmDays(e.target.value)}
                aria-label="Período sem retorno"
              >
                {['15', '30', '60'].map((d) => (
                  <option key={d} value={d}>
                    {d} dias sem retornar
                  </option>
                ))}
              </Select>
            </CardHeader>
            <CardContent>
              {inactive.length ? (
                inactive.map((c, i) => (
                  <div key={c.id} className="crm-row">
                    <div className="person">
                      <Avatar name={c.name} index={i} />
                      <div>
                        <b>{c.name}</b>
                        <small>{c.phone}</small>
                      </div>
                    </div>
                    <span className="muted text-sm">
                      {c.whatsappConsent ? 'WhatsApp autorizado' : 'Sem autorização de WhatsApp'}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        initialBooking();
                        setBooking((b) => ({ ...b, clientId: c.id }));
                      }}
                    >
                      Agendar retorno
                    </Button>
                  </div>
                ))
              ) : (
                <Empty>Seus clientes estão voltando. Nenhum cliente neste filtro.</Empty>
              )}
            </CardContent>
          </Card>
          <Card className="mt-5">
            <CardHeader>
              <CardTitle>Aniversariantes do mês</CardTitle>
            </CardHeader>
            <CardContent>
              {birthdays.map((c) => (
                <div className="dre-row" key={c.id}>
                  <b>{c.name}</b>
                  <span>{c.birthDate?.split('-').reverse().join('/')}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      );
    }
    if (page === 'whatsapp')
      return (
        <>
          <Card className="integration-banner">
            <span className="integration-icon">
              <MessageCircle size={28} />
            </span>
            <div>
              <h2>Uma conversa faz toda a diferença.</h2>
              <p>Confirmações, lembretes e relacionamento em um só fluxo.</p>
            </div>
            <span className="status status-agendado">Configuração necessária</span>
          </Card>
          <div className="notice mt-5">
            <ShieldCheck size={18} />
            <p>
              Os adaptadores Evolution API e WhatsApp Business estão preparados no backend.
              Configure as credenciais e os templates aprovados no servidor para ativar o envio.
              Esta demonstração não envia mensagens.
            </p>
          </div>
          <div className="automation-grid mt-5">
            {[
              {
                title: 'Confirmação de agendamento',
                text: 'Logo após uma nova reserva.',
                time: 'Imediato',
              },
              {
                title: 'Lembrete antecipado',
                text: 'Ajude o cliente a organizar o dia.',
                time: '24h antes',
              },
              {
                title: 'Seu horário está chegando',
                text: 'Um lembrete perto do atendimento.',
                time: '2h antes',
              },
              {
                title: 'Feliz aniversário',
                text: 'Uma mensagem no dia especial.',
                time: 'Aniversário',
              },
              {
                title: 'Sentimos sua falta',
                text: 'Convide o cliente para voltar.',
                time: 'Reativação',
              },
            ].map((a) => (
              <Card key={a.title} className="automation-card">
                <div className="flex items-center justify-between">
                  <MessageCircle size={19} className="text-primary" />
                  <span className="tag">{a.time}</span>
                </div>
                <h2>{a.title}</h2>
                <p>{a.text}</p>
                <span className="card-caption">Preparado no backend</span>
              </Card>
            ))}
          </div>
          <Card className="mt-5">
            <CardHeader>
              <CardTitle>Histórico de notificações</CardTitle>
            </CardHeader>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Mensagem</th>
                    <th>Destinatário</th>
                    <th>Data</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.notifications.map((n) => (
                    <tr key={n.id}>
                      <td>{n.kind}</td>
                      <td>{n.recipient}</td>
                      <td>{dateLabel(n.dueAt)}</td>
                      <td>
                        <Badge status={n.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      );
    if (page === 'relatorios')
      return (
        <>
          <div className="report-grid">
            {['receita', 'clientes', 'barbeiros', 'servicos', 'comissoes', 'agendamentos'].map(
              (kind, i) => (
                <Card key={kind} className="report-card">
                  <span className={`service-icon avatar-${i % 5}`}>
                    <BarChart3 size={23} />
                  </span>
                  <h2>{kind[0].toUpperCase() + kind.slice(1)}</h2>
                  <p>Dados consolidados da sua empresa.</p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setReportKind(kind);
                      setDialog('report');
                    }}
                  >
                    <Download size={15} />
                    Exportar relatório
                  </Button>
                </Card>
              ),
            )}
          </div>
          <div className="notice mt-5">
            <CircleHelp size={18} />
            <p>
              {isDemo()
                ? 'Na demonstração, a impressão gera PDF da tela e o CSV exporta o fluxo de caixa. Os seis relatórios PDF e Excel por período são gerados pela API autenticada.'
                : 'Os relatórios são gerados pelo servidor com os dados da sua empresa.'}
            </p>
          </div>
        </>
      );
    if (page === 'empresas') return companiesTable();
    if (page === 'planos')
      return (
        <>
          <div className="plan-intro">
            <span className="eyebrow">CRESÇA NO SEU RITMO</span>
            <h2>Um plano para cada fase da sua barbearia.</h2>
            <p>Mais tempo para cuidar dos clientes. Mais controle para crescer.</p>
          </div>
          <div className="plans-grid">
            {[
              {
                name: 'Start',
                price: 49,
                features: [
                  '1 unidade',
                  'Até 2 barbeiros',
                  'Até 200 clientes',
                  'Agenda e serviços',
                  'Agendamento online',
                ],
              },
              {
                name: 'Pro',
                price: 99,
                features: [
                  '1 unidade',
                  'Até 8 barbeiros',
                  'Clientes ilimitados',
                  'WhatsApp e comissões',
                  'Financeiro básico e relatórios',
                ],
              },
              {
                name: 'Premium',
                price: 199,
                features: [
                  'Até 3 unidades',
                  'Até 25 barbeiros',
                  'Financeiro avançado',
                  'Estoque e CRM',
                  'Metas e dashboard executivo',
                ],
              },
              {
                name: 'Enterprise',
                price: 0,
                features: [
                  'Unidades ilimitadas',
                  'Barbeiros ilimitados',
                  'White label',
                  'API completa',
                  'SLA contratado',
                ],
              },
            ].map((p) => (
              <Card
                key={p.name}
                className={cn(
                  'plan-card',
                  p.name.toUpperCase() === (user?.planCode || 'PREMIUM') && 'plan-selected',
                )}
              >
                {p.name.toUpperCase() === (user?.planCode || 'PREMIUM') && (
                  <span className="plan-label">
                    Seu plano atual{isDemo() ? ' · demonstração' : ''}
                  </span>
                )}
                <h2>{p.name}</h2>
                <div className="plan-price">
                  {p.price ? (
                    <>
                      <strong>R$ {p.price}</strong>
                      <span>/ mês</span>
                    </>
                  ) : (
                    <strong>Sob consulta</strong>
                  )}
                </div>
                <div className="plan-features">
                  {p.features.map((f) => (
                    <p key={f}>
                      <Check size={15} />
                      {f}
                    </p>
                  ))}
                </div>
                <Button
                  variant={
                    p.name.toUpperCase() === (user?.planCode || 'PREMIUM') ? 'default' : 'outline'
                  }
                  className="w-full"
                  onClick={() => setDialog('plan-info')}
                >
                  {p.name.toUpperCase() === (user?.planCode || 'PREMIUM')
                    ? 'Plano atual'
                    : 'Ver contratação'}
                </Button>
              </Card>
            ))}
          </div>
        </>
      );
    if (page === 'configuracoes')
      return (
        <div className="settings-grid">
          <Card>
            <CardHeader>
              <CardTitle>{role === 'CLIENTE' ? 'Meu perfil' : 'Perfil e acesso'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="person mb-6">
                <Avatar name={displayName} size="large" />
                <div>
                  <b>{displayName}</b>
                  <small>{role === 'EMPRESA' ? 'Administrador' : role}</small>
                </div>
              </div>
              <div className="dre-row">
                <span>Ambiente</span>
                <b>{isDemo() ? 'Demonstração' : 'API autenticada'}</b>
              </div>
              <div className="dre-row">
                <span>Empresa</span>
                <b>{workspaceName}</b>
              </div>
              <div className="dre-row">
                <span>Fuso horário</span>
                <b>America/Sao_Paulo</b>
              </div>
              <Button className="mt-6" variant="outline" onClick={() => setDialog('account')}>
                <LogIn size={16} />
                Gerenciar conta
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Preferências</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="dre-row">
                <div>
                  <b>Aparência</b>
                  <p className="card-caption">Escolha como o BarberHub aparece para você.</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                  {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}{' '}
                  {theme === 'dark' ? 'Escuro' : 'Claro'}
                </Button>
              </div>
              <div className="notice mt-6">
                <ShieldCheck size={20} />
                <p>
                  Seu perfil é definido pela sua conta. O acesso aos dados da empresa respeita as
                  permissões atribuídas a você.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    return null;
  };

  const titles: Record<string, string> = {
    dashboard:
      role === 'MASTER' ? 'Visão da plataforma' : role === 'CLIENTE' ? 'Seu espaço' : 'Visão geral',
    agenda: 'Agenda',
    clientes: 'Clientes',
    barbeiros: 'Sua equipe',
    servicos: 'Serviços',
    financeiro: 'Financeiro',
    comissoes: 'Comissões',
    estoque: 'Estoque',
    crm: 'Relacionamento',
    whatsapp: 'WhatsApp',
    relatorios: 'Relatórios',
    empresas: 'Empresas',
    planos: 'Planos e assinatura',
    configuracoes: 'Configurações',
  };
  const subtitles: Record<string, string> = {
    dashboard:
      role === 'MASTER'
        ? 'Acompanhe os negócios que crescem com o BarberHub.'
        : role === 'CLIENTE'
          ? 'Seu cuidado, no seu tempo.'
          : 'Sua barbearia em sintonia. Confira os resultados.',
    agenda: 'Organize o dia. Cuide de cada detalhe.',
    clientes: 'Conheça quem confia no seu trabalho.',
    barbeiros: 'Talento e cuidado, trabalhando juntos.',
    servicos: 'O seu trabalho merece uma boa apresentação.',
    financeiro: 'Clareza para tomar as próximas decisões.',
    comissoes: 'Reconheça cada atendimento da sua equipe.',
    estoque: 'Tudo pronto para o próximo cliente.',
    crm: 'Transforme uma visita em uma relação duradoura.',
    whatsapp: 'Esteja presente antes e depois do atendimento.',
    relatorios: 'Os números que ajudam seu negócio a evoluir.',
    empresas: 'Gerencie as barbearias da sua plataforma.',
    planos: 'O próximo passo do seu negócio começa aqui.',
    configuracoes: 'Seu BarberHub, do seu jeito.',
  };

  if (restoring)
    return (
      <div className="auth-loading" role="status">
        Verificando sua sessão…
      </div>
    );
  if (!access)
    return (
      <AuthPage
        onSession={acceptSession}
        initialPortal={
          location.pathname.startsWith('/master')
            ? 'master'
            : location.pathname.startsWith('/cliente')
              ? 'client'
              : 'team'
        }
        onDemo={(demoRole) => {
          setRole(demoRole);
          setUser(null);
          setApiMode(false);
          setAccess(true);
          setPage('dashboard');
          qc.clear();
        }}
      />
    );
  return (
    <div className="app-shell">
      {mobile && <div className="mobile-overlay" onClick={() => setMobile(false)} />}
      <aside
        id="workspace-sidebar"
        ref={sidebarRef}
        inert={compactSidebar && !mobile}
        className={cn('sidebar', mobile && 'sidebar-open')}
      >
        <Button
          variant="ghost"
          size="icon"
          className="sidebar-close"
          aria-label="Fechar menu"
          onClick={() => setMobile(false)}
        >
          <X size={20} />
        </Button>
        <a className="brand" href="#dashboard" onClick={() => go('dashboard')}>
          <span className="brand-mark">
            <Scissors size={22} />
          </span>
          <span>
            barber<span className="brand-hub">hub</span>
            <span className="brand-dot">.</span>
          </span>
        </a>
        <button
          className="workspace-selector"
          disabled={role === 'MASTER'}
          onClick={() => setDialog('workspace')}
        >
          <span className="workspace-logo">{initials(workspaceName)}</span>
          <span>
            <b>{workspaceName}</b>
            <small>
              {role === 'MASTER'
                ? 'Plataforma'
                : data?.units.find((u) => u.id === selectedUnit)?.name ||
                  data?.units[0]?.name ||
                  'Todas as unidades'}
            </small>
          </span>
          <ChevronDown size={15} />
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Navegação principal">
          {navigation
            .filter(
              (n) => allowedPages.includes(n.id) && !['planos', 'configuracoes'].includes(n.id),
            )
            .map((n) => (
              <button
                key={n.id}
                className={cn('nav-item', page === n.id && 'nav-active')}
                onClick={() => go(n.id)}
              >
                <n.icon size={18} />
                <span>{n.label}</span>
                {n.id === 'agenda' && <span className="nav-count">{activeToday.length}</span>}
                {n.id === 'whatsapp' && <span className="nav-new">NOVO</span>}
              </button>
            ))}
        </nav>
        <div className="nav-label management-label">GERENCIAMENTO</div>
        <nav>
          {navigation
            .filter(
              (n) => ['planos', 'configuracoes'].includes(n.id) && allowedPages.includes(n.id),
            )
            .map((n) => (
              <button
                key={n.id}
                className={cn('nav-item', page === n.id && 'nav-active')}
                onClick={() => go(n.id)}
              >
                <n.icon size={18} />
                <span>{n.label}</span>
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          {role === 'EMPRESA' && (
            <div className="premium-box">
              <div>
                <Crown size={16} />
                <b>Plano {user?.planCode || 'Premium'}</b>
              </div>
              <p>Seu negócio, com mais possibilidades.</p>
              <button onClick={() => go('planos')}>
                Gerenciar assinatura
                <ChevronRight size={14} />
              </button>
            </div>
          )}
          <button className="help-link" onClick={() => setDialog('help')}>
            <CircleHelp size={17} />
            Central de ajuda
          </button>
          <Button
            variant="ghost"
            className="sidebar-signout"
            onClick={() => void signOut()}
            disabled={saving}
          >
            <LogOut size={17} />
            {isDemo() ? 'Sair da demonstração' : 'Sair da conta'}
          </Button>
          <button className="user-menu" onClick={() => setDialog('account')}>
            <Avatar name={displayName} />
            <span>
              <b>{displayName}</b>
              <small>
                {role === 'EMPRESA'
                  ? 'Administrador'
                  : role === 'MASTER'
                    ? 'Master'
                    : role === 'BARBEIRO'
                      ? 'Barbeiro'
                      : 'Cliente'}
              </small>
            </span>
            <ChevronDown size={15} />
          </button>
        </div>
      </aside>
      <div className="main-shell" inert={compactSidebar && mobile}>
        <header className="topbar">
          <div className="breadcrumbs">
            <Button
              size="icon"
              variant="ghost"
              className="mobile-menu"
              aria-label="Abrir menu"
              aria-controls="workspace-sidebar"
              aria-expanded={mobile}
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </Button>
            <span className="breadcrumb-workspace">Workspace</span>
            <ChevronRight size={13} />
            <b>{titles[page]}</b>
          </div>
          <div className="top-actions">
            {isDemo() && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAccess(false);
                }}
              >
                <LogIn size={15} />
                Entrar
              </Button>
            )}
            <span className="demo-tag">{isDemo() ? 'Demonstração' : 'Conectado à API'}</span>
            <div className="global-search">
              <Search size={15} />
              <input
                aria-label="Buscar nesta página"
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>/</kbd>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Alternar tema"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
            <div className="notification-wrap">
              <Button
                size="icon"
                variant="ghost"
                aria-label="Notificações"
                onClick={() => setNotificationOpen(!notificationOpen)}
              >
                <Bell size={18} />
                <span className="notification-dot" />
              </Button>
              {notificationOpen && (
                <Card className="notification-popover">
                  <CardHeader>
                    <CardTitle>Notificações</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Fechar notificações"
                      onClick={() => setNotificationOpen(false)}
                    >
                      <X size={16} />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {data?.products
                      .filter((p) => p.quantity < p.minimum)
                      .map((p) => (
                        <div className="notification-item" key={p.id}>
                          <Package size={17} />
                          <div>
                            <b>Estoque baixo</b>
                            <p>
                              {p.name}: {p.quantity} unidades
                            </p>
                          </div>
                        </div>
                      ))}
                    <div className="notification-item">
                      <CalendarDays size={17} />
                      <div>
                        <b>Sua agenda de hoje</b>
                        <p>{activeToday.length} agendamentos para acompanhar.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
            <span className="top-divider" />
            <Avatar name={displayName} />
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="heading-eyebrow">
                {page === 'dashboard' ? 'SEU NEGÓCIO, EM PERSPECTIVA' : workspaceName.toUpperCase()}
              </div>
              <h1>
                {titles[page]}
                {page === 'dashboard' && role === 'EMPRESA' && <span className="heading-dot" />}
              </h1>
              <p>{subtitles[page]}</p>
            </div>
            <div className="heading-actions">
              {role === 'EMPRESA' &&
                (isDemo() || features().includes('reports')) &&
                !['planos', 'configuracoes', 'whatsapp'].includes(page) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setReportKind('receita');
                      setDialog('report');
                    }}
                  >
                    <Download size={15} />
                    <span>Exportar</span>
                  </Button>
                )}
              {['dashboard', 'agenda'].includes(page) && role !== 'MASTER' && (
                <Button onClick={() => initialBooking()}>
                  <Plus size={17} />
                  Novo agendamento
                </Button>
              )}
            </div>
          </div>
          {['dashboard', 'financeiro', 'comissoes', 'barbeiros'].includes(page) &&
            role !== 'MASTER' &&
            role !== 'CLIENTE' && (
              <div className="period-bar">
                <div className="segmented" role="group" aria-label="Período dos indicadores">
                  {['Hoje', 'Semana', 'Mês'].map((p) => (
                    <button
                      aria-pressed={period === p}
                      className={period === p ? 'selected' : ''}
                      onClick={() => setPeriod(p)}
                      key={p}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <span className="date-range">
                  <CalendarDays size={15} />
                  {dateLabel(from.toISOString())} – {dateLabel(`${today}T12:00:00-03:00`)}
                  <ChevronDown size={13} />
                </span>
              </div>
            )}
          {isLoading ? (
            <Card className="loading-state">
              <span className="spinner" />
              Carregando sua barbearia...
            </Card>
          ) : error ? (
            <Card className="error-state">
              <h2>Não foi possível carregar os dados</h2>
              <p>{(error as Error).message}</p>
              <Button onClick={() => refresh()}>Tentar novamente</Button>
            </Card>
          ) : (
            <Suspense fallback={<Card className="loading-state">Carregando indicadores...</Card>}>
              {screen()}
            </Suspense>
          )}
          <footer className="main-footer">
            <span>Feito para quem cuida de pessoas.</span>
            <span>
              BarberHub <span className="footer-version">v0.1</span>
            </span>
          </footer>
        </main>
      </div>

      <Dialog
        open={['clients', 'services', 'barbers', 'entries', 'products', 'units'].includes(dialog)}
        onOpenChange={() => setDialog('')}
        title={
          (
            {
              clients: 'Novo cliente',
              services: 'Novo serviço',
              barbers: 'Adicionar barbeiro',
              entries: 'Novo lançamento',
              products: 'Novo produto',
              units: 'Nova unidade',
            } as Record<string, string>
          )[dialog] || ''
        }
      >
        <form
          className="form-grid"
          onSubmit={form.handleSubmit(async (v) => {
            let payload: any = { name: v.name };
            if (dialog === 'clients') {
              if (!v.phone || !/^[0-9+ ()-]{10,20}$/.test(v.phone)) {
                form.setError('phone', { message: 'Informe um telefone válido.' });
                return;
              }
              payload = {
                ...payload,
                phone: v.phone,
                email: v.email || undefined,
                birthDate: v.birthDate || undefined,
                whatsappConsent: v.consent,
              };
            }
            if (dialog === 'services')
              payload = {
                ...payload,
                description: v.description,
                durationMinutes: v.duration,
                priceCents: Math.round((v.price || 0) * 100),
              };
            if (dialog === 'barbers')
              payload = {
                ...payload,
                email: v.email || undefined,
                commissionPercent: v.commission,
                goalCents: 500000,
                unitId: selectedUnit || data?.units[0]?.id,
              };
            if (dialog === 'entries')
              payload = {
                description: v.name,
                type: v.type,
                method: v.method,
                amountCents: Math.round((v.price || 0) * 100),
              };
            if (dialog === 'products') {
              if (!v.sku) {
                form.setError('sku', { message: 'Informe o SKU.' });
                return;
              }
              payload = {
                ...payload,
                sku: v.sku,
                quantity: v.quantity,
                minimum: v.minimum,
                priceCents: Math.round((v.price || 0) * 100),
                costCents: Math.round((v.cost || 0) * 100),
              };
            }
            await run(() => createEntity(dialog as any, payload), 'Cadastro salvo.');
          })}
        >
          <Field
            label={dialog === 'entries' ? 'Descrição' : 'Nome'}
            error={form.formState.errors.name?.message}
          >
            <Input
              {...form.register('name')}
              autoFocus
              placeholder={dialog === 'clients' ? 'Nome completo' : 'Nome ou descrição'}
            />
          </Field>
          {['clients', 'barbers'].includes(dialog) && (
            <Field label="Email" error={form.formState.errors.email?.message}>
              <Input {...form.register('email')} type="email" placeholder="nome@exemplo.com" />
            </Field>
          )}
          {dialog === 'clients' && (
            <>
              <Field label="Telefone" error={form.formState.errors.phone?.message}>
                <Input {...form.register('phone')} placeholder="11999999999" />
              </Field>
              <Field label="Data de nascimento">
                <Input {...form.register('birthDate')} type="date" />
              </Field>
              <label className="checkbox-label">
                <input type="checkbox" {...form.register('consent')} />
                Cliente autoriza mensagens por WhatsApp
              </label>
            </>
          )}
          {['services', 'entries', 'products'].includes(dialog) && (
            <Field label="Valor (R$)">
              <Input type="number" step="0.01" min="0" {...form.register('price')} />
            </Field>
          )}
          {dialog === 'services' && (
            <>
              <Field label="Duração (minutos)">
                <Input type="number" min="5" max="480" {...form.register('duration')} />
              </Field>
              <Field label="Descrição">
                <Input {...form.register('description')} />
              </Field>
            </>
          )}
          {dialog === 'barbers' && (
            <Field label="Comissão (%)">
              <Input type="number" min="0" max="100" {...form.register('commission')} />
            </Field>
          )}
          {dialog === 'entries' && (
            <>
              <Field label="Tipo">
                <Select {...form.register('type')}>
                  <option value="INCOME">Entrada</option>
                  <option value="EXPENSE">Saída</option>
                </Select>
              </Field>
              <Field label="Pagamento">
                <Select {...form.register('method')}>
                  {['PIX', 'DINHEIRO', 'CREDITO', 'DEBITO'].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </Select>
              </Field>
            </>
          )}
          {dialog === 'products' && (
            <>
              <Field label="Custo de aquisição (R$)">
                <Input type="number" min="0" step="0.01" {...form.register('cost')} />
              </Field>
              <Field label="SKU" error={form.formState.errors.sku?.message}>
                <Input {...form.register('sku')} />
              </Field>
              <div className="form-row">
                <Field label="Quantidade inicial">
                  <Input type="number" min="0" {...form.register('quantity')} />
                </Field>
                <Field label="Estoque mínimo">
                  <Input type="number" min="0" {...form.register('minimum')} />
                </Field>
              </div>
            </>
          )}
          <div className="form-actions">
            <Button type="button" variant="outline" onClick={() => setDialog('')}>
              Cancelar
            </Button>
            <Button disabled={saving} type="submit">
              {saving ? 'Salvando...' : 'Salvar cadastro'}
            </Button>
          </div>
        </form>
      </Dialog>
      <Dialog
        open={dialog === 'appointment'}
        onOpenChange={() => setDialog('')}
        title={reschedule ? 'Reagendar atendimento' : 'Novo agendamento'}
        description="Escolha o serviço, o profissional e um horário disponível."
      >
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            if (!slot) {
              toast.error('Escolha um horário.');
              return;
            }
            run(
              () =>
                saveAppointment(
                  {
                    clientId: booking.clientId,
                    barberId: booking.barberId,
                    serviceId: booking.serviceId,
                    startsAt: slot,
                  },
                  reschedule?.id,
                ),
              'Agendamento salvo.',
            );
          }}
        >
          {role !== 'CLIENTE' && (
            <Field label="Cliente">
              <Select
                required
                value={booking.clientId}
                onChange={(e) => setBooking({ ...booking, clientId: e.target.value })}
              >
                {clients.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Serviço">
            <Select
              required
              value={booking.serviceId}
              onChange={(e) => {
                setBooking({ ...booking, serviceId: e.target.value });
                setSlot('');
              }}
            >
              {data?.services.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name} · {s.durationMinutes} min · {money(s.priceCents)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="form-row">
            <Field label="Barbeiro">
              <Select
                required
                value={booking.barberId}
                onChange={(e) => {
                  setBooking({ ...booking, barberId: e.target.value });
                  setSlot('');
                }}
              >
                {data?.barbers
                  .filter((b) => role !== 'BARBEIRO' || b.id === ownBarber)
                  .map((b) => (
                    <option value={b.id} key={b.id}>
                      {b.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Data">
              <Input
                type="date"
                min={today}
                required
                value={booking.date}
                onInput={(e) => {
                  setBooking({ ...booking, date: e.currentTarget.value });
                  setSlot('');
                }}
                onChange={(e) => {
                  setBooking({ ...booking, date: e.target.value });
                  setSlot('');
                }}
              />
            </Field>
          </div>
          <Field label="Horários disponíveis">
            <div className="slot-grid">
              {slots.isLoading ? (
                <p className="card-caption">Buscando horários...</p>
              ) : slots.error ? (
                <p className="text-red-400 text-sm">{(slots.error as Error).message}</p>
              ) : ((slots.data as string[]) || []).length ? (
                (slots.data as string[]).map((s) => (
                  <button
                    type="button"
                    key={s}
                    className={cn('slot', slot === s && 'slot-selected')}
                    onClick={() => setSlot(s)}
                  >
                    {timeLabel(s)}
                  </button>
                ))
              ) : (
                <p className="card-caption">Nenhum horário disponível. Escolha outro dia.</p>
              )}
            </div>
          </Field>
          <div className="form-actions">
            <Button type="button" variant="outline" onClick={() => setDialog('')}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !slot}>
              {saving ? 'Salvando...' : reschedule ? 'Reagendar' : 'Confirmar agendamento'}
            </Button>
          </div>
        </form>
      </Dialog>
      <Dialog
        open={dialog === 'detail'}
        onOpenChange={() => setDialog('')}
        title="Detalhes do atendimento"
        description={selected?.client.name}
      >
        {selected && (
          <div className="form-grid">
            <div className="appointment-detail">
              <Avatar name={selected.client.name} size="large" />
              <div>
                <h3>{selected.service.name}</h3>
                <p>{selected.barber.name}</p>
                <p>
                  {dateLabel(selected.startsAt)} · {timeLabel(selected.startsAt)}–
                  {timeLabel(selected.endsAt)}
                </p>
              </div>
              <Badge status={selected.status} />
            </div>
            <div className="dre-row">
              <span>Valor</span>
              <b>{money(selected.priceCents)}</b>
            </div>
            {role !== 'CLIENTE' && selected.status === 'AGENDADO' && (
              <Button
                onClick={() =>
                  run(() => updateStatus(selected.id, 'CONFIRMADO'), 'Agendamento confirmado.')
                }
              >
                Confirmar presença
              </Button>
            )}
            {role !== 'CLIENTE' && ['AGENDADO', 'CONFIRMADO'].includes(selected.status) && (
              <Button
                onClick={() =>
                  run(() => updateStatus(selected.id, 'EM_ATENDIMENTO'), 'Atendimento iniciado.')
                }
              >
                Iniciar atendimento
              </Button>
            )}
            {role !== 'CLIENTE' && selected.status === 'EM_ATENDIMENTO' && (
              <>
                <Field label="Método de pagamento">
                  <Select
                    value={form.watch('method')}
                    onChange={(e) => form.setValue('method', e.target.value)}
                  >
                    {['PIX', 'DINHEIRO', 'CREDITO', 'DEBITO'].map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </Select>
                </Field>
                <Button
                  onClick={() =>
                    run(
                      () => updateStatus(selected.id, 'FINALIZADO', form.getValues('method')),
                      'Atendimento finalizado. Pagamento e comissão registrados.',
                    )
                  }
                >
                  Finalizar e registrar pagamento
                </Button>
              </>
            )}
            {['AGENDADO', 'CONFIRMADO'].includes(selected.status) && (
              <>
                <Button variant="outline" onClick={() => initialBooking(selected)}>
                  Reagendar
                </Button>
                <Button variant="destructive" onClick={() => setDialog('cancel')}>
                  Cancelar agendamento
                </Button>
                {role !== 'CLIENTE' && (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      run(() => updateStatus(selected.id, 'NAO_COMPARECEU'), 'Ausência registrada.')
                    }
                  >
                    Registrar não comparecimento
                  </Button>
                )}
              </>
            )}
            {role === 'CLIENTE' && selected.status === 'FINALIZADO' && (
              <Button onClick={() => setDialog('review')}>
                <Star size={17} />
                Avaliar atendimento
              </Button>
            )}
          </div>
        )}
      </Dialog>
      <Dialog
        open={dialog === 'cancel'}
        onOpenChange={() => setDialog('')}
        title="Cancelar agendamento?"
        description="O horário será liberado na agenda."
      >
        <div className="form-actions">
          <Button variant="outline" onClick={() => setDialog('detail')}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            disabled={saving}
            onClick={() =>
              run(() => updateStatus(selected!.id, 'CANCELADO'), 'Agendamento cancelado.')
            }
          >
            Confirmar cancelamento
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={dialog === 'stock'}
        onOpenChange={() => setDialog('')}
        title="Movimentação de estoque"
      >
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => moveStock(stockId, Number(stockDelta), stockReason),
              'Movimentação registrada.',
            );
          }}
        >
          <Field label="Quantidade (negativa para saída)">
            <Input
              required
              type="number"
              value={stockDelta}
              onChange={(e) => setStockDelta(e.target.value)}
            />
          </Field>
          <Field label="Motivo">
            <Input
              required
              minLength={3}
              value={stockReason}
              onChange={(e) => setStockReason(e.target.value)}
            />
          </Field>
          <Button type="submit" disabled={saving}>
            Registrar movimentação
          </Button>
        </form>
      </Dialog>
      <Dialog
        open={dialog === 'block'}
        onOpenChange={() => setDialog('')}
        title="Bloquear horário"
        description="Reserve períodos de almoço, folgas, férias ou horários especiais."
      >
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            if ((!blockEndDay || blockEndDay === day) && blockEnd <= blockStart) {
              toast.error('O fim deve ser posterior ao início.');
              return;
            }
            run(
              () =>
                addBlock({
                  barberId: booking.barberId || data!.barbers[0].id,
                  startsAt: new Date(`${day}T${blockStart}:00-03:00`).toISOString(),
                  endsAt: new Date(`${blockEndDay || day}T${blockEnd}:00-03:00`).toISOString(),
                  reason: blockReason,
                }),
              'Bloqueio registrado.',
            );
          }}
        >
          <Field label="Profissional">
            <Select
              value={booking.barberId || data?.barbers[0]?.id}
              onChange={(e) => setBooking({ ...booking, barberId: e.target.value })}
            >
              {data?.barbers.map((b) => (
                <option value={b.id} key={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Data">
            <Input type="date" required value={day} onChange={(e) => setDay(e.target.value)} />
          </Field>
          <div className="form-row">
            <Field label="Início">
              <Input
                type="time"
                required
                value={blockStart}
                onChange={(e) => setBlockStart(e.target.value)}
              />
            </Field>
            <Field label="Data final">
              <Input
                type="date"
                min={day}
                value={blockEndDay || day}
                onChange={(e) => setBlockEndDay(e.target.value)}
              />
            </Field>
            <Field label="Fim">
              <Input
                type="time"
                required
                value={blockEnd}
                onChange={(e) => setBlockEnd(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Motivo">
            <Select value={blockReason} onChange={(e) => setBlockReason(e.target.value)}>
              {['Almoço', 'Folga', 'Férias', 'Horário especial'].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Field>
          <Button disabled={saving} type="submit">
            Bloquear horário
          </Button>
        </form>
      </Dialog>
      <Dialog
        open={dialog === 'review'}
        onOpenChange={() => setDialog('')}
        title="Como foi seu atendimento?"
      >
        <div className="form-grid">
          <div className="rating-stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} aria-label={`${n} estrelas`} onClick={() => setRating(n)}>
                <Star size={30} fill={n <= rating ? '#b99cff' : 'none'} className="text-primary" />
              </button>
            ))}
          </div>
          <Field label="Comentário">
            <Input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Conte o que achou..."
            />
          </Field>
          <Button
            onClick={() => run(() => review(selected!.id, rating, comment), 'Avaliação enviada.')}
            disabled={saving}
          >
            Enviar avaliação
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={dialog === 'account'}
        onOpenChange={() => setDialog('')}
        title="Sua conta"
        description="Gerencie seu acesso ao BarberHub."
      >
        <div className="form-grid">
          <p>
            <strong>{displayName}</strong>
          </p>
          {user?.email && <p className="auth-note">{user.email}</p>}
          <p className="auth-note">
            {
              {
                MASTER: 'Proprietário da plataforma',
                EMPRESA: 'Gestor da barbearia',
                BARBEIRO: 'Barbeiro',
                CLIENTE: 'Cliente',
              }[role]
            }
          </p>
          {isDemo() ? (
            <p className="auth-note">
              Esta é uma demonstração com dados fictícios. Entre com sua conta para usar dados
              reais.
            </p>
          ) : user?.googleLinked ? (
            <p className="auth-note">Conta Google vinculada.</p>
          ) : (
            <>
              <p className="auth-note">
                Vincule o Google para entrar com o mesmo email da sua conta.
              </p>
              <GoogleButton
                onCredential={async (credential) => {
                  try {
                    await linkGoogle(credential);
                    setUser((current) => (current ? { ...current, googleLinked: true } : current));
                    toast.success('Google vinculado.');
                  } catch (e) {
                    toast.error((e as Error).message);
                    throw e;
                  }
                }}
              />
            </>
          )}
          <Button variant="outline" onClick={() => void signOut()} disabled={saving}>
            <LogOut size={16} />
            {isDemo() ? 'Voltar ao acesso' : 'Sair da conta'}
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={dialog === 'report'}
        onOpenChange={() => setDialog('')}
        title="Exportar relatório"
        description={
          isDemo()
            ? 'Demonstração: PDF por impressão e CSV do fluxo de caixa. Na API, exportação completa em PDF e Excel.'
            : 'Escolha o formato do relatório.'
        }
      >
        <div className="form-grid">
          <div className="form-row">
            <Field label="De">
              <Input
                type="date"
                value={booking.date}
                onChange={(e) => setBooking({ ...booking, date: e.target.value })}
              />
            </Field>
            <Field label="Até">
              <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            </Field>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              run(
                () =>
                  exportReport(
                    reportKind,
                    'pdf',
                    `${booking.date}T00:00:00-03:00`,
                    `${day}T23:59:59-03:00`,
                  ),
                'PDF preparado.',
              )
            }
          >
            <Download size={16} /> {isDemo() ? 'Imprimir / Salvar PDF' : 'Baixar PDF'}
          </Button>
          <Button
            onClick={() =>
              run(
                () =>
                  exportReport(
                    reportKind,
                    'xlsx',
                    `${booking.date}T00:00:00-03:00`,
                    `${day}T23:59:59-03:00`,
                  ),
                'Exportação concluída.',
              )
            }
          >
            <Download size={16} />
            {isDemo() ? 'Baixar CSV financeiro' : 'Baixar Excel'}
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={dialog === 'workspace'}
        onOpenChange={() => setDialog('')}
        title="Suas unidades"
        description="Dados separados por empresa; unidades compartilham a mesma gestão."
      >
        <div className="profile-options">
          <button
            onClick={() => {
              setSelectedUnit('');
              setDialog('');
            }}
          >
            <span className="unit-icon">
              <Building2 size={20} />
            </span>
            <div>
              <b>Todas as unidades</b>
              <small>Visão consolidada</small>
            </div>
          </button>
          {data?.units.map((u) => (
            <button
              key={u.id}
              onClick={() => {
                setSelectedUnit(u.id);
                setDialog('');
              }}
            >
              <span className="unit-icon">
                <Building2 size={20} />
              </span>
              <div>
                <b>{u.name}</b>
                <small>{workspaceName}</small>
              </div>
              <Check size={18} />
            </button>
          ))}
        </div>
        {role === 'EMPRESA' && (
          <Button variant="outline" className="w-full mt-5" onClick={() => openForm('units')}>
            <Plus size={16} />
            Nova unidade
          </Button>
        )}
      </Dialog>
      <Dialog
        open={dialog === 'company-create'}
        onOpenChange={() => setDialog('')}
        title="Nova empresa"
        description="Crie a barbearia e a conta do seu administrador."
      >
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => provisionCompany(newCompany), 'Empresa criada com sucesso.');
          }}
        >
          <Field label="Nome da empresa">
            <Input
              required
              minLength={2}
              value={newCompany.name}
              onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
            />
          </Field>
          <Field label="Identificador da empresa">
            <Input
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              placeholder="barbearia-central"
              value={newCompany.slug}
              onChange={(e) => setNewCompany({ ...newCompany, slug: e.target.value })}
            />
          </Field>
          <Field label="Plano">
            <Select
              value={newCompany.planCode}
              onChange={(e) => setNewCompany({ ...newCompany, planCode: e.target.value })}
            >
              {['START', 'PRO', 'PREMIUM', 'ENTERPRISE'].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
          </Field>
          <Field label="Nome do administrador">
            <Input
              required
              minLength={2}
              value={newCompany.admin.name}
              onChange={(e) =>
                setNewCompany({
                  ...newCompany,
                  admin: { ...newCompany.admin, name: e.target.value },
                })
              }
            />
          </Field>
          <Field label="Email do administrador">
            <Input
              type="email"
              required
              value={newCompany.admin.email}
              onChange={(e) =>
                setNewCompany({
                  ...newCompany,
                  admin: { ...newCompany.admin, email: e.target.value },
                })
              }
            />
          </Field>
          <Field label="Senha inicial (12 caracteres ou mais)">
            <Input
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              value={newCompany.admin.password}
              onChange={(e) =>
                setNewCompany({
                  ...newCompany,
                  admin: { ...newCompany.admin, password: e.target.value },
                })
              }
            />
          </Field>
          <Button type="submit" disabled={saving}>
            Criar empresa
          </Button>
        </form>
      </Dialog>
      <Dialog
        open={dialog === 'plan-info'}
        onOpenChange={() => setDialog('')}
        title="Contratação de plano"
        description="A contratação financeira depende da integração com o provedor de cobrança."
      >
        <p className="text-sm leading-6 text-muted-foreground">
          O Master pode alterar planos e limites pela gestão de empresas. Checkout, cobrança
          recorrente e negociação Enterprise são etapas previstas no roadmap.
        </p>
      </Dialog>
      <Dialog
        open={dialog === 'help'}
        onOpenChange={() => setDialog('')}
        title="Bem-vindo ao BarberHub"
        description="Um guia rápido para explorar sua barbearia."
      >
        <div className="help-content">
          <p>
            <b>Agenda:</b> crie reservas, escolha horários disponíveis e acompanhe o atendimento até
            a finalização.
          </p>
          <p>
            <b>Financeiro e comissões:</b> finalizar um atendimento registra o recebimento e calcula
            a comissão.
          </p>
          <p>
            <b>Perfis:</b> clique no seu nome no rodapé lateral para experimentar Master, empresa,
            barbeiro e cliente.
          </p>
          <p>
            <b>Demonstração:</b> os dados são de exemplo e as alterações duram até recarregar a
            página. Conecte à API para usar o PostgreSQL.
          </p>
        </div>
      </Dialog>
    </div>
  );
}
