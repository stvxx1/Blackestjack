import { cardValue, type Card, type CardValue } from './cards';

export interface CountingSystem {
  readonly id: 'hi-lo' | 'ko' | 'omega-ii';
  readonly name: string;
  /** Balanced systems sum to zero over a full deck and use a true count. */
  readonly balanced: boolean;
  /** Tag per card value; index 1 is the ace. */
  readonly tags: Readonly<Record<CardValue, number>>;
  /** Starting running count for a fresh shoe. */
  readonly initialRunningCount: (decks: number) => number;
}

export const HI_LO: CountingSystem = {
  id: 'hi-lo',
  name: 'Hi-Lo',
  balanced: true,
  tags: { 1: -1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 0, 8: 0, 9: 0, 10: -1 },
  initialRunningCount: () => 0,
};

/** Knock-Out: unbalanced (7 counts +1), so the running count is used directly with a pivot. */
export const KO: CountingSystem = {
  id: 'ko',
  name: 'Knock-Out (KO)',
  balanced: false,
  tags: { 1: -1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 0, 9: 0, 10: -1 },
  initialRunningCount: (decks) => 4 - 4 * decks,
};

export const OMEGA_II: CountingSystem = {
  id: 'omega-ii',
  name: 'Omega II',
  balanced: true,
  tags: { 1: 0, 2: 1, 3: 1, 4: 2, 5: 2, 6: 2, 7: 1, 8: 0, 9: -1, 10: -2 },
  initialRunningCount: () => 0,
};

export const COUNTING_SYSTEMS = [HI_LO, KO, OMEGA_II] as const;

export function tagFor(system: CountingSystem, card: Pick<Card, 'rank'>): number {
  return system.tags[cardValue(card)];
}

export function runningCount(system: CountingSystem, cards: readonly Pick<Card, 'rank'>[], start = 0): number {
  return cards.reduce((rc, card) => rc + tagFor(system, card), start);
}

/**
 * Running count divided by decks remaining. Decks remaining is floored at a
 * quarter deck so the figure stays sane at the very end of a shoe.
 */
export function trueCount(running: number, decksRemaining: number): number {
  return running / Math.max(decksRemaining, 0.25);
}

/** Most index tables assume the true count is floored (toward negative infinity). */
export function flooredTrueCount(running: number, decksRemaining: number): number {
  return Math.floor(trueCount(running, decksRemaining));
}
