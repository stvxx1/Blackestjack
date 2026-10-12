import type { ReactNode } from 'react';
import { hrefFor, type Route } from '@/hooks/useHashRoute';
import { money } from '@/lib/format';
import { useGameStore } from '@/state/gameStore';
import { useTableView } from '@/state/tableViewStore';

const NAV: readonly { route: Route; label: string; icon: string }[] = [
  { route: 'table', label: 'Table', icon: '♠' },
  { route: 'trainer', label: 'Trainer', icon: '◆' },
  { route: 'counting', label: 'Counting', icon: '±' },
  { route: 'stats', label: 'Stats', icon: '▤' },
  { route: 'settings', label: 'Settings', icon: '⚙' },
];

/** Bankroll as the player should see it: payouts land once the dealer's hand is revealed. */
function useDisplayedBankroll(): number {
  const bankroll = useGameStore((s) => s.game.bankroll);
  const result = useGameStore((s) => s.game.result);
  const revealing = useTableView((s) => s.revealing);
  if (!revealing || !result) return bankroll;
  const returned = [...result.hands, ...(result.insurance ? [result.insurance] : [])].reduce((n, h) => n + h.returned, 0);
  return bankroll - returned;
}

export function AppShell({ route, children }: { route: Route; children: ReactNode }) {
  const bankroll = useDisplayedBankroll();
  return (
    <div className="flex min-h-dvh flex-col bg-[radial-gradient(ellipse_at_top,var(--color-felt-800),var(--color-felt-950)_70%)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-brass-300 focus:px-3 focus:py-2 focus:text-felt-950">
        Skip to content
      </a>
      <header className="sticky top-0 z-20 border-b border-white/8 bg-felt-950/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <a href={hrefFor('table')} className="flex items-center gap-2 font-display text-xl text-brass-300">
            <span aria-hidden className="text-2xl leading-none">♠</span>
            <span>
              Blackjack<span className="text-ink">Wiz</span>
            </span>
          </a>
          <nav aria-label="Main" className="ml-4 hidden md:block">
            <ul className="flex gap-1">
              {NAV.map((n) => (
                <li key={n.route}>
                  <a
                    href={hrefFor(n.route)}
                    aria-current={route === n.route ? 'page' : undefined}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      route === n.route ? 'bg-white/10 text-ink' : 'text-ink-3 hover:text-ink'
                    }`}
                  >
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-2 rounded-full bg-black/40 py-1 pr-3 pl-1.5 ring-1 ring-brass-400/30" aria-label={`Bankroll ${money(bankroll)}`}>
            <span aria-hidden className="flex size-6 items-center justify-center rounded-full bg-brass-400 text-xs font-bold text-felt-950">
              $
            </span>
            <span className="tabular font-semibold" aria-live="polite">
              {money(bankroll)}
            </span>
          </div>
        </div>
      </header>

      <main id="main" className="flex min-h-0 flex-1 flex-col pb-16 md:pb-0">
        {children}
      </main>

      {/* Bottom tabs on phones */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-felt-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="grid grid-cols-5">
          {NAV.map((n) => (
            <li key={n.route}>
              <a
                href={hrefFor(n.route)}
                aria-current={route === n.route ? 'page' : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[0.7rem] font-medium ${route === n.route ? 'text-brass-300' : 'text-ink-3'}`}
              >
                <span aria-hidden className="text-lg leading-none">
                  {n.icon}
                </span>
                {n.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
