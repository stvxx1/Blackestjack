import { useEffect, useState } from 'react';

/**
 * The engine resolves the dealer's whole hand in one transition. This replays it for the
 * eye: when `total` grows while `active`, the visible count climbs one card per `stepMs`.
 * `resetKey` (the round number) snaps back to showing everything for a new round.
 * Timers are cleared on every change and on unmount.
 */
export function useStagedReveal(total: number, active: boolean, stepMs: number, resetKey: number): number {
  const [state, setState] = useState({ key: resetKey, shown: total });

  // New round, or staging switched off: show everything straight away. Only update when
  // something changed, or the render-phase setState would loop.
  let current = state;
  if (state.key !== resetKey || (!active && state.shown !== total)) {
    current = { key: resetKey, shown: total };
    setState(current);
  }

  const shown = Math.min(current.shown, total);
  useEffect(() => {
    if (!active || shown >= total) return undefined;
    const id = window.setTimeout(() => {
      setState((s) => ({ ...s, shown: Math.min(s.shown + 1, total) }));
    }, stepMs);
    return () => {
      window.clearTimeout(id);
    };
  }, [active, shown, total, stepMs]);

  return shown;
}
