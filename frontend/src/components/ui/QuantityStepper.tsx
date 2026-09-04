import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface QuantityStepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  /** Nome do item — entra no `aria-label` dos botões. */
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
  disabled?: boolean;
}

/** Controle +/− de quantidade, com alvos de toque confortáveis no celular. */
export function QuantityStepper({
  value,
  onChange,
  min = 0,
  max = 99,
  label,
  size = 'md',
  className,
  disabled,
}: QuantityStepperProps) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  const suffix = label ? ` de ${label}` : '';

  const buttonClass = cn(
    'flex items-center justify-center rounded-full border border-gold-500/25 bg-onyx-800/80',
    'text-ivory transition-all duration-150 active:scale-90',
    'hover:border-gold-500/50 hover:bg-onyx-700',
    'disabled:pointer-events-none disabled:opacity-35',
    size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
  );

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <button
        type="button"
        className={buttonClass}
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || value <= min}
        aria-label={`Diminuir quantidade${suffix}`}
      >
        <Minus className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden />
      </button>

      <span
        className={cn(
          'tabular text-center font-semibold text-ivory',
          size === 'sm' ? 'w-6 text-sm' : 'w-8 text-lg'
        )}
        aria-live="polite"
        aria-label={`Quantidade${suffix}: ${value}`}
      >
        {value}
      </span>

      <button
        type="button"
        className={buttonClass}
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled || value >= max}
        aria-label={`Aumentar quantidade${suffix}`}
      >
        <Plus className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden />
      </button>
    </div>
  );
}
