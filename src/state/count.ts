import {
  CARDS_PER_DECK,
  COUNTING_SYSTEMS,
  flooredTrueCount,
  fullComposition,
  removeFromComposition,
  runningCount,
  visibleCards,
  type Card,
  type Composition,
  type CountingSystem,
  type GameState,
} from '@/engine';

export type CountingSystemId = CountingSystem['id'];

export function countingSystem(id: CountingSystemId): CountingSystem {
  return COUNTING_SYSTEMS.find((s) => s.id === id) ?? COUNTING_SYSTEMS[0];
}

export function isCountingSystemId(value: unknown): value is CountingSystemId {
  return COUNTING_SYSTEMS.some((s) => s.id === value);
}

export interface CountInfo {
  readonly running: number;
  /** Floored true count; null for unbalanced systems, which use the running count directly. */
  readonly trueCount: number | null;
  /** Unseen cards (including any face-down hole card) in decks. */
  readonly decksRemaining: number;
  readonly cardsSeen: number;
}

/** The count exactly as a player at the table could know it. */
export function countInfo(game: GameState, system: CountingSystem): CountInfo {
  const seen = visibleCards(game);
  const running = runningCount(system, seen, system.initialRunningCount(game.rules.decks));
  const unseen = game.shoe.cards.length - game.shoe.burned - seen.length;
  const decksRemaining = unseen / CARDS_PER_DECK;
  return {
    running,
    trueCount: system.balanced ? flooredTrueCount(running, decksRemaining) : null,
    decksRemaining,
    cardsSeen: seen.length,
  };
}

/**
 * The shoe as a counter knows it: a fresh shoe minus every visible card except the
 * ones listed in `keep` (the hand being evaluated, which the EV solver removes itself).
 */
export function unseenComposition(game: GameState, keep: readonly Card[] = []): Composition {
  const keepIds = new Set(keep.map((c) => c.id));
  return removeFromComposition(
    fullComposition(game.rules.decks),
    visibleCards(game).filter((c) => !keepIds.has(c.id)),
  );
}
