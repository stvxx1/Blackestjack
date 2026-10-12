import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Kbd } from './Kbd';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: Variant;
  readonly size?: 'sm' | 'md' | 'lg';
  /** Keyboard shortcut shown as a hint and exposed via aria-keyshortcuts. */
  readonly shortcut?: string;
  /** Draws a pulsing ring, e.g. the coach's suggested move. */
  readonly highlight?: boolean;
  readonly children: ReactNode;
}

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-linear-to-b from-brass-300 to-brass-500 text-felt-950 shadow-[0_2px_0_var(--color-brass-700)] hover:from-brass-200 hover:to-brass-400 active:translate-y-px active:shadow-none',
  secondary: 'bg-white/10 text-ink ring-1 ring-white/15 hover:bg-white/15 active:bg-white/20',
  ghost: 'text-ink-2 hover:text-ink hover:bg-white/8',
  danger: 'bg-bad/15 text-bad ring-1 ring-bad/40 hover:bg-bad/25',
};

const SIZE = { sm: 'h-8 px-3 text-sm gap-1.5', md: 'h-11 px-4 text-[0.95rem] gap-2', lg: 'h-13 px-6 text-base gap-2' };

export function Button({
  variant = 'secondary',
  size = 'md',
  shortcut,
  highlight = false,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      aria-keyshortcuts={shortcut}
      className={`relative inline-flex select-none items-center justify-center rounded-xl font-semibold transition-[background,transform,box-shadow,opacity] disabled:opacity-35 disabled:saturate-50 ${
        VARIANT[variant]
      } ${SIZE[size]} ${highlight ? 'ring-2 ring-brass-300 ring-offset-2 ring-offset-felt-900 motion-safe:animate-pulse' : ''} ${className}`}
      {...rest}
    >
      {children}
      {shortcut && <Kbd className="max-sm:hidden">{shortcut}</Kbd>}
    </button>
  );
}
