import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  /** `flat` remove o brilho superior; `strong` escurece e arredonda mais. */
  tone?: 'default' | 'flat' | 'strong';
  interactive?: boolean;
}

/** Superfície de vidro — base de praticamente todo bloco do app. */
export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(function GlassCard(
  { tone = 'default', interactive, className, children, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        tone === 'flat' ? 'glass-flat' : tone === 'strong' ? 'glass-strong' : 'glass',
        interactive &&
          'cursor-pointer transition-all duration-300 ease-brand hover:-translate-y-0.5 ' +
            'hover:border-gold-500/40 hover:shadow-glass-lg',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
});

export interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.18em] text-gold-500/80">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-3xl leading-tight text-ivory sm:text-4xl">{title}</h1>
        {description ? <p className="mt-1.5 max-w-xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export interface SectionTitleProps {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function SectionTitle({ children, action, className }: SectionTitleProps) {
  return (
    <div className={cn('mb-3 flex items-center justify-between gap-3', className)}>
      <h2 className="font-display text-xl text-ivory">{children}</h2>
      {action}
    </div>
  );
}

/** Filete dourado que separa blocos sem pesar. */
export function Rule({ className }: { className?: string }) {
  return <div className={cn('brand-rule', className)} aria-hidden />;
}

/** Rótulo pequeno em caixa alta, usado nos resumos e fichas. */
export function DataLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'block text-2xs font-semibold uppercase tracking-[0.16em] text-muted/70',
        className
      )}
    >
      {children}
    </span>
  );
}

export function DataValue({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('block text-sm text-ivory', className)}>{children}</span>;
}
