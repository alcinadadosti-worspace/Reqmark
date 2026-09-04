import { Ban, CheckCircle2, Clock3, RotateCcw, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { RequestStatus } from '@/shared/types';
import { cn } from '@/lib/cn';

interface StatusMeta {
  label: string;
  /** Rótulo curto para espaços apertados (chips em listas). */
  short: string;
  icon: LucideIcon;
  chip: string;
  dot: string;
  text: string;
}

/**
 * Paleta de status da seção 5: pendente em dourado de contorno, aprovada em
 * verde, reprovada em vermelho, cancelada em cinza, devolvida em azul.
 */
export const STATUS_META: Record<RequestStatus, StatusMeta> = {
  pending: {
    label: 'Pendente',
    short: 'Pendente',
    icon: Clock3,
    chip: 'border-gold-500/45 bg-gold-500/10 text-gold-300',
    dot: 'bg-gold-400',
    text: 'text-gold-300',
  },
  approved: {
    label: 'Aprovada',
    short: 'Aprovada',
    icon: CheckCircle2,
    chip: 'border-status-approved/40 bg-status-approved/10 text-status-approved',
    dot: 'bg-status-approved',
    text: 'text-status-approved',
  },
  rejected: {
    label: 'Reprovada',
    short: 'Reprovada',
    icon: XCircle,
    chip: 'border-status-rejected/40 bg-status-rejected/10 text-status-rejected',
    dot: 'bg-status-rejected',
    text: 'text-status-rejected',
  },
  cancelled: {
    label: 'Cancelada',
    short: 'Cancelada',
    icon: Ban,
    chip: 'border-status-cancelled/40 bg-status-cancelled/10 text-status-cancelled',
    dot: 'bg-status-cancelled',
    text: 'text-status-cancelled',
  },
  returned: {
    label: 'Devolvida',
    short: 'Devolvida',
    icon: RotateCcw,
    chip: 'border-status-returned/40 bg-status-returned/10 text-status-returned',
    dot: 'bg-status-returned',
    text: 'text-status-returned',
  },
};

export interface StatusChipProps {
  status: RequestStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export function StatusChip({ status, size = 'md', showIcon = true, className }: StatusChipProps) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        size === 'sm' && 'px-2 py-0.5 text-2xs',
        size === 'md' && 'px-2.5 py-1 text-xs',
        size === 'lg' && 'px-3.5 py-1.5 text-sm',
        meta.chip,
        className
      )}
    >
      {showIcon ? (
        <Icon className={cn(size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5')} aria-hidden />
      ) : (
        <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} aria-hidden />
      )}
      {meta.label}
    </span>
  );
}

/** Etiqueta genérica (categoria, tag, "3 dias"...). */
export function Pill({
  children,
  className,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  className?: string;
  tone?: 'neutral' | 'gold' | 'warning' | 'danger';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs',
        tone === 'neutral' && 'border-onyx-700 bg-onyx-800/70 text-muted',
        tone === 'gold' && 'border-gold-500/35 bg-gold-500/10 text-gold-300',
        tone === 'warning' && 'border-gold-500/45 bg-gold-500/12 text-gold-300',
        tone === 'danger' && 'border-status-rejected/40 bg-status-rejected/10 text-status-rejected',
        className
      )}
    >
      {children}
    </span>
  );
}
