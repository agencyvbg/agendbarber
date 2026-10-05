import type React from 'react';
import type { ReactNode } from 'react';
import { CalendarDays, ArrowUpRight, Users } from 'lucide-react';
import { cn, initials } from '../lib/utils';
import { statusLabels, type Status } from '../lib/data';
import { Card } from './ui/card';
export function Avatar({
  name,
  index = 0,
  size = 'normal',
}: {
  name: string;
  index?: number;
  size?: 'normal' | 'large';
}) {
  return (
    <span className={cn('avatar', `avatar-${index % 5}`, size === 'large' && 'avatar-lg')}>
      {initials(name)}
    </span>
  );
}
export function Badge({ status }: { status: Status | string }) {
  return (
    <span className={`status status-${status.toLowerCase()}`}>
      {statusLabels[status as Status] ||
        (
          {
            ACTIVE: 'Ativa',
            SUSPENDED: 'Suspensa',
            CANCELLED: 'Cancelada',
            PENDING: 'Pendente',
            SENT: 'Enviada',
            INCOME: 'Entrada',
            EXPENSE: 'Saída',
          } as Record<string, string>
        )[status] ||
        status}
    </span>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <CalendarDays size={26} />
      <p>{children}</p>
    </div>
  );
}
export function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: ReactNode;
  error?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {error && <small className="text-red-400">{error}</small>}
    </label>
  );
}
export function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className="select" {...props}>
      {children}
    </select>
  );
}
export function Kpi({
  title,
  value,
  icon: Icon,
  trend,
  sub,
}: {
  title: string;
  value: string;
  icon: typeof Users;
  trend?: string;
  sub?: string;
}) {
  return (
    <Card className="kpi">
      <div className="kpi-top">
        <span>{title}</span>
        <span className="kpi-icon">
          <Icon size={17} />
        </span>
      </div>
      <strong>{value}</strong>
      <div className="kpi-bottom">
        {trend && (
          <span className="trend">
            <ArrowUpRight size={13} />
            {trend}
          </span>
        )}
        <span>{sub || 'no período selecionado'}</span>
      </div>
    </Card>
  );
}
