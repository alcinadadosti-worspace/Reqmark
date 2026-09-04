import { useMemo } from 'react';
import { cn } from '@/lib/cn';

/** Iniciais: primeira letra do primeiro e do último nome relevante. */
export function initialsOf(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    // Preposições não viram inicial ("José dos Santos" -> JS, não JDS).
    .filter((part) => part.length > 2 || /^[A-ZÀ-Ú]/.test(part))
    .filter((part) => !['de', 'da', 'do', 'das', 'dos', 'e'].includes(part.toLowerCase()));

  if (parts.length === 0) return name.slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Ângulo do gradiente derivado do nome: cada pessoa recebe sempre a mesma
 * variação dourada, sem sair da paleta.
 */
function hueFromName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 360;
  return hash;
}

export interface AvatarProps {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** Contorno dourado mais forte — usado para a administradora. */
  highlighted?: boolean;
}

const SIZES = {
  xs: 'h-6 w-6 text-[0.6rem]',
  sm: 'h-8 w-8 text-2xs',
  md: 'h-10 w-10 text-xs',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-xl',
};

export function Avatar({ name, size = 'md', className, highlighted }: AvatarProps) {
  const { initials, angle } = useMemo(
    () => ({ initials: initialsOf(name), angle: hueFromName(name) }),
    [name]
  );

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border font-semibold tracking-wide',
        'text-gold-300',
        highlighted ? 'border-gold-500/60' : 'border-gold-500/25',
        SIZES[size],
        className
      )}
      style={{
        background: `linear-gradient(${angle}deg, rgba(243,210,140,0.16), rgba(165,121,61,0.08))`,
      }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
