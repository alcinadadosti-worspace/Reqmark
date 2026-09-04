import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Bloco de carregamento com brilho dourado atravessando. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn('h-3', index === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('glass-flat space-y-4 p-5', className)} aria-hidden>
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-1/2" />
          <Skeleton className="h-2.5 w-1/3" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  );
}

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-muted', className)} role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label ? <span className="text-sm">{label}</span> : <span className="sr-only">Carregando</span>}
    </span>
  );
}

export function LoadingScreen({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3" role="status">
      <span className="relative flex h-12 w-12 items-center justify-center">
        <span className="absolute inset-0 rounded-full border border-gold-500/25" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-gold-400" />
      </span>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

export interface EmptyStateProps {
  /** Ilustração em linha dourada — normalmente um ícone grande. */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-3xl border border-dashed border-gold-500/20 ' +
          'bg-onyx-900/40 px-6 py-14 text-center',
        className
      )}
    >
      {icon ? (
        <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-gold-500/20 bg-gold-500/5 text-gold-400/70">
          {icon}
        </span>
      ) : null}
      <h3 className="font-display text-xl text-ivory">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Caixa de erro discreta, mas impossível de ignorar. */
export function ErrorNotice({
  title = 'Algo deu errado',
  message,
  action,
  className,
}: {
  title?: ReactNode;
  message: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-2xl border border-status-rejected/30 bg-status-rejected/8 p-4 text-sm',
        className
      )}
    >
      <p className="font-medium text-status-rejected">{title}</p>
      <p className="mt-1 leading-relaxed text-ivory/80">{message}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
