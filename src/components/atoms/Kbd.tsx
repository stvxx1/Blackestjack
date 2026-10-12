import type { ReactNode } from 'react';

export function Kbd({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      aria-hidden
      className={`inline-flex min-w-[1.4em] items-center justify-center rounded-md border border-current/25 px-1 font-sans text-[0.7em] font-semibold uppercase opacity-70 ${className}`}
    >
      {children}
    </kbd>
  );
}
