import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface ChipProps {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
  disabled?: boolean;
  /** Botão de seleção (`aria-pressed`) em vez de link/ação simples. */
  toggle?: boolean;
}

export function Chip({ selected, onClick, children, icon, className, disabled, toggle = true }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={toggle ? Boolean(selected) : undefined}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm',
        'transition-all duration-200 ease-brand active:scale-[0.97]',
        'disabled:pointer-events-none disabled:opacity-40',
        selected
          ? 'border-gold-500/60 bg-gold-500/15 text-gold-300 shadow-[0_0_0_1px_rgba(206,161,92,0.18)]'
          : 'border-onyx-700 bg-onyx-800/60 text-muted hover:border-gold-500/35 hover:text-ivory',
        className
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/** Faixa horizontal de chips que rola no celular sem barra visível. */
export function ChipRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-1', className)}>
      {children}
    </div>
  );
}

export function ChipWrap({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap gap-2', className)}>{children}</div>;
}
