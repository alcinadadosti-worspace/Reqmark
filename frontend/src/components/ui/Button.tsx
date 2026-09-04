import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import ClickSpark from '@/components/reactbits/ClickSpark/ClickSpark';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'subtle';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const BASE =
  'relative inline-flex select-none items-center justify-center gap-2 rounded-full font-medium ' +
  'transition-all duration-200 ease-brand disabled:pointer-events-none disabled:opacity-45 ' +
  'active:scale-[0.97] whitespace-nowrap';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-gradient text-onyx-950 font-semibold shadow-gold hover:shadow-gold-glow ' +
    'hover:brightness-110',
  secondary:
    'border border-gold-500/25 bg-onyx-800/70 text-ivory backdrop-blur-md hover:border-gold-500/50 ' +
    'hover:bg-onyx-800',
  ghost: 'text-muted hover:bg-onyx-800/70 hover:text-ivory',
  danger:
    'border border-status-rejected/35 bg-status-rejected/10 text-status-rejected ' +
    'hover:bg-status-rejected/20 hover:border-status-rejected/60',
  success:
    'border border-status-approved/35 bg-status-approved/10 text-status-approved ' +
    'hover:bg-status-approved/20 hover:border-status-approved/60',
  subtle: 'bg-onyx-800/60 text-muted hover:text-ivory hover:bg-onyx-700/60',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-[0.95rem]',
  lg: 'h-13 px-7 text-base',
  icon: 'h-10 w-10',
};

export function buttonStyles(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string
): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Faisca dourada no clique (React Bits `ClickSpark`). */
  spark?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, spark, icon, className, children, disabled, ...rest },
  ref
) {
  const button = (
    <button
      ref={ref}
      className={buttonStyles(variant, size, className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );

  if (!spark) return button;

  return (
    <ClickSpark sparkColor="#F3D28C" sparkCount={9} sparkSize={7} sparkRadius={18} duration={420}>
      {button}
    </ClickSpark>
  );
});

export interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}

/** Mesmo visual do Button, mas navega de verdade (mantém acessibilidade de link). */
export function ButtonLink({
  variant = 'primary',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={buttonStyles(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
