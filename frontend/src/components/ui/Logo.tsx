import { cn } from '@/lib/cn';

export interface LogoProps {
  size?: number;
  className?: string;
  /** Halo dourado atrás do monograma — usado nas telas grandes. */
  glow?: boolean;
  priority?: boolean;
}

/** O monograma "AM". Fica sempre sobre fundo escuro, como na identidade. */
export function LogoMark({ size = 40, className, glow, priority }: LogoProps) {
  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      {glow ? (
        <span
          className="pointer-events-none absolute inset-0 -z-10 rounded-full blur-2xl"
          style={{ background: 'radial-gradient(circle, rgba(226,185,111,0.35), transparent 68%)' }}
          aria-hidden
        />
      ) : null}
      <img
        src="/logo-am.png"
        alt="AM Marketing"
        width={size}
        height={size}
        className="h-full w-full object-contain"
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
      />
    </span>
  );
}

export interface WordmarkProps {
  className?: string;
  size?: number;
  subtitle?: boolean;
}

/** Monograma + nome do produto, na composição usada no cabeçalho. */
export function Logo({ className, size = 34, subtitle }: WordmarkProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={size} priority />
      <span className="min-w-0 leading-none">
        <span className="block font-display text-lg tracking-wide text-ivory">AM Marketing</span>
        {subtitle ? (
          <span className="mt-0.5 block text-2xs uppercase tracking-[0.18em] text-gold-500/75">
            Requisições de materiais
          </span>
        ) : null}
      </span>
    </span>
  );
}
