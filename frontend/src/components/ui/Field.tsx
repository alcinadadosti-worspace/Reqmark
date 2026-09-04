import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const CONTROL =
  'w-full rounded-xl border border-gold-500/18 bg-onyx-900/70 px-4 text-ivory placeholder:text-muted/55 ' +
  'transition-colors duration-200 backdrop-blur-sm ' +
  'hover:border-gold-500/30 focus:border-gold-500/60 focus:outline-none ' +
  'focus:ring-2 focus:ring-gold-500/25 disabled:opacity-50';

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  /** Contador `123/500` no canto do rótulo. */
  counter?: ReactNode;
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
  className?: string;
}

/**
 * Envelope de formulário: rótulo associado, dica, erro e `aria-describedby`
 * ligados corretamente — o critério de acessibilidade pede rótulos em todos os
 * campos.
 */
export function Field({ label, hint, error, required, counter, children, className }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={id} className="text-sm font-medium text-ivory/90">
            {label}
            {required ? <span className="ml-1 text-gold-400">*</span> : null}
          </label>
          {counter ? <span className="tabular text-2xs text-muted">{counter}</span> : null}
        </div>
      ) : null}

      {children({ id, describedBy, invalid: Boolean(error) })}

      {error ? (
        <p id={errorId} className="text-xs text-status-rejected" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, leading, trailing, ...rest },
  ref
) {
  const control = (
    <input
      ref={ref}
      className={cn(
        CONTROL,
        'h-12',
        leading && 'pl-11',
        trailing && 'pr-11',
        invalid && 'border-status-rejected/60 focus:border-status-rejected focus:ring-status-rejected/25',
        className
      )}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );

  if (!leading && !trailing) return control;

  return (
    <div className="relative">
      {leading ? (
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
          {leading}
        </span>
      ) : null}
      {control}
      {trailing ? (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">{trailing}</span>
      ) : null}
    </div>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, ...rest },
  ref
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        CONTROL,
        'min-h-[7rem] resize-y py-3 leading-relaxed',
        invalid && 'border-status-rejected/60 focus:border-status-rejected focus:ring-status-rejected/25',
        className
      )}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
});

/** Interruptor acessível para as opções do painel admin. */
export function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors duration-200',
          checked ? 'border-gold-500/60 bg-gold-500/30' : 'border-onyx-600 bg-onyx-800'
        )}
      >
        <span
          className={cn(
            'block h-4 w-4 rounded-full transition-transform duration-200 ease-brand',
            checked ? 'translate-x-6 bg-gold-300' : 'translate-x-1 bg-muted'
          )}
        />
      </button>
      <span className="min-w-0">
        <span className="block text-sm text-ivory">{label}</span>
        {description ? <span className="block text-xs text-muted">{description}</span> : null}
      </span>
    </label>
  );
}
