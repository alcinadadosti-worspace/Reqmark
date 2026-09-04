import { cn } from '@/lib/cn';

export interface AvailabilityRingProps {
  available: number;
  total: number;
  /** Unidades pré-reservadas por requisições pendentes (arco tracejado). */
  pending?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  /** Rótulo lido por leitores de tela; o texto visual é só o número. */
  label?: string;
}

/**
 * Anel de disponibilidade: "3 de 4 livres hoje".
 *
 * Três leituras ao mesmo tempo — o número no centro, a proporção do arco e a
 * cor (dourado = tem, vermelho = esgotado). O arco tracejado externo mostra as
 * pré-reservas pendentes, que não bloqueiam mas podem virar bloqueio.
 */
export function AvailabilityRing({
  available,
  total,
  pending = 0,
  size = 56,
  strokeWidth = 3,
  className,
  label,
}: AvailabilityRingProps) {
  const safeTotal = Math.max(1, total);
  const clampedAvailable = Math.max(0, Math.min(available, safeTotal));
  const ratio = clampedAvailable / safeTotal;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * ratio;

  const exhausted = clampedAvailable <= 0;
  const tight = !exhausted && ratio <= 0.34;

  const pendingRatio = Math.min(1, Math.max(0, pending / safeTotal));

  return (
    <div
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `${clampedAvailable} de ${total} disponíveis`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        {/* Trilho */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(206,161,92,0.14)"
          strokeWidth={strokeWidth}
        />

        {/* Pré-reservas pendentes: tracejado por fora do arco cheio */}
        {pendingRatio > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(226,185,111,0.45)"
            strokeWidth={1}
            strokeDasharray={`${circumference * pendingRatio} ${circumference}`}
            strokeDashoffset={-dash}
            opacity={0.75}
          />
        ) : null}

        {/* Disponível */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={exhausted ? '#F43F5E' : tight ? '#E2B96F' : '#CEA15C'}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className="transition-[stroke-dasharray,stroke] duration-500 ease-brand"
        />
      </svg>

      <span
        className={cn(
          'tabular absolute font-display font-medium leading-none',
          exhausted ? 'text-status-rejected' : 'text-gold-300'
        )}
        style={{ fontSize: size * 0.34 }}
      >
        {clampedAvailable}
      </span>
    </div>
  );
}
