import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Wallet, Users, UserRound, TrendingUp, Scissors, Target, ChevronRight } from 'lucide-react';
import { Kpi, Avatar } from '../components/shared';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { money, dateLabel } from '../lib/utils';
import type { Snapshot, Appointment, Client, Role } from '../lib/data';
const colors = ['#9c7bff', '#7255cc', '#b99cff', '#57436f', '#d5c4ff'];
interface Props {
  data?: Snapshot;
  role: Role;
  ownBarber?: string;
  period: string;
  revenue: number;
  completed: Appointment[];
  clients: Client[];
  from: Date;
  chartData: { name: string; value: number }[];
  serviceData: { name: string; value: number }[];
  activeToday: Appointment[];
  day: string;
  go: (s: string) => void;
  appointmentTable: (a: Appointment[], compact?: boolean) => ReactNode;
}
export default function Dashboard({
  data,
  role,
  ownBarber,
  period,
  revenue,
  completed,
  clients,
  from,
  chartData,
  serviceData,
  activeToday,
  day,
  go,
  appointmentTable,
}: Props) {
  return (
    <>
      <div className="stats-grid">
        <Kpi
          title="Receita total"
          value={money(revenue)}
          icon={Wallet}
          sub={`${completed.length} atendimentos finalizados`}
        />
        <Kpi
          title="Clientes atendidos"
          value={String(new Set(completed.map((a) => a.clientId)).size)}
          icon={Users}
          sub="clientes únicos no período"
        />
        <Kpi
          title="Novos clientes"
          value={String(clients.filter((c) => new Date(c.createdAt) >= from).length)}
          icon={UserRound}
          sub="cadastrados no período"
        />
        <Kpi
          title="Ticket médio"
          value={money(completed.length ? Math.round(revenue / completed.length) : 0)}
          icon={TrendingUp}
          sub="por atendimento finalizado"
        />
      </div>
      <div className="chart-grid">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Receita no período</CardTitle>
              <p className="card-caption">Acompanhe o crescimento da sua barbearia</p>
            </div>
            <span className="chart-legend">
              <i />
              Receita
            </span>
          </CardHeader>
          <CardContent>
            <div className="chart-summary">
              <strong>{money(revenue)}</strong>
              <span>
                {period === 'Mês' ? 'Este mês' : period === 'Semana' ? 'Últimos 7 dias' : 'Hoje'}
              </span>
            </div>
            <div className="revenue-chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 12, right: 8, left: -14, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#9c7bff" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#9c7bff" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                    minTickGap={25}
                    dy={9}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                    tickFormatter={(v) => `R$ ${v >= 1000 ? `${v / 1000}k` : v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      fontSize: 13,
                    }}
                    formatter={(v: number) => [money(v * 100), 'Receita']}
                    labelFormatter={(v) => `Dia ${v}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#9c7bff"
                    strokeWidth={2.5}
                    fill="url(#revenue-fill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="performance">
          <CardHeader>
            <div>
              <CardTitle>Performance da equipe</CardTitle>
              <p className="card-caption">Receita por profissional</p>
            </div>
            <Scissors size={17} className="muted" />
          </CardHeader>
          <CardContent>
            <div className="barber-performance">
              {data?.barbers
                .filter((b) => role !== 'BARBEIRO' || b.id === ownBarber)
                .map((b, i) => {
                  const total = completed
                    .filter((a) => a.barberId === b.id)
                    .reduce((s, a) => s + a.priceCents, 0);
                  return (
                    <div key={b.id} className="performance-person">
                      <div className="performance-heading">
                        <div className="person">
                          <Avatar name={b.name} index={i} />
                          <div>
                            <b>{b.name}</b>
                            <small>
                              {completed.filter((a) => a.barberId === b.id).length} atendimentos
                            </small>
                          </div>
                        </div>
                        <strong>{money(total)}</strong>
                      </div>
                      <div className="progress">
                        <span
                          style={{
                            width: `${Math.min(100, (total / b.goalCents) * 100)}%`,
                            background: colors[i],
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
            <div className="team-insight">
              <Target size={17} />
              <div>
                <b>Cada atendimento conta.</b>
                <p>Uma boa experiência traz o cliente de volta.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="bottom-grid">
        <Card className="agenda-preview">
          <CardHeader>
            <div className="section-title">
              <CardTitle>Agenda de hoje</CardTitle>
              <span className="count-badge">{activeToday.length}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => go('agenda')}>
              Ver agenda
              <ChevronRight size={14} />
            </Button>
          </CardHeader>
          {appointmentTable(activeToday.slice(0, 5), true)}
          <div className="table-footer">
            <span>
              {activeToday.length} agendamentos · {dateLabel(`${day}T12:00:00-03:00`)}
            </span>
            <span>
              <i className="legend-dot" />
              {activeToday.filter((a) => a.status === 'CONFIRMADO').length} confirmados
            </span>
          </div>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Serviços mais procurados</CardTitle>
              <p className="card-caption">Atendimentos finalizados no período</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="donut">
              <ResponsiveContainer width="100%" height={165}>
                <PieChart>
                  <Pie
                    data={serviceData}
                    dataKey="value"
                    innerRadius={56}
                    outerRadius={74}
                    paddingAngle={4}
                    stroke="none"
                  >
                    {serviceData.map((_, i) => (
                      <Cell key={i} fill={colors[i % 5]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center">
                <strong>{completed.length}</strong>
                <span>serviços</span>
              </div>
            </div>
            <div className="service-legend">
              {serviceData.slice(0, 4).map((s, i) => (
                <div key={s.name}>
                  <span>
                    <i style={{ background: colors[i] }} />
                    {s.name}
                  </span>
                  <b>{completed.length ? Math.round((s.value / completed.length) * 100) : 0}%</b>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
