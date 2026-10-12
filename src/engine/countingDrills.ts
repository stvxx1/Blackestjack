import { CARDS_PER_DECK, createCards, SUITS, type Card, type CardValue, type Rank } from './cards';
import { flooredTrueCount, runningCount, type CountingSystem } from './counting';
import { recommendPlay, indexPlaysFor, shouldInsure, type IndexPlay } from './deviations';
import type { PlayerMove } from './game';
import { nextInt, shuffle, type RngState } from './rng';
import type { RuleSet } from './rules';

/**
 * Counting drills. Each generator is pure: it takes an RNG state and returns the drill
 * plus the next RNG state. Timing is the UI's job; graders just take an answer.
 */

export type CountingDrillKind = 'running' | 'trueCount' | 'countdown' | 'deviation';

/** Flash a run of cards; the player reports the running count at the end. */
export interface RunningCountDrill {
  readonly kind: 'running';
  readonly cards: readonly Card[];
  readonly answer: number;
}

/** Convert a running count to a true count given the discard tray. */
export interface TrueCountDrill {
  readonly kind: 'trueCount';
  readonly runningCount: number;
  /** In half-deck steps, as you'd eyeball it from the discard tray. */
  readonly decksRemaining: number;
  readonly answer: number;
}

/** Count down a deck with cards secretly removed; the final count reveals what's missing. */
export interface CountdownDrill {
  readonly kind: 'countdown';
  readonly cards: readonly Card[];
  readonly removed: readonly Card[];
  readonly answer: number;
}

/** A hand where an index play may or may not apply at the given true count. */
export interface DeviationDrill {
  readonly kind: 'deviation';
  readonly play: IndexPlay;
  readonly cards: readonly Card[];
  readonly upcard: Card;
  readonly trueCount: number;
  readonly available: readonly PlayerMove[];
  readonly answer: PlayerMove | 'insure' | 'decline';
}

export type CountingDrill = RunningCountDrill | TrueCountDrill | CountdownDrill | DeviationDrill;

function picker(rng: RngState): { int: (n: number) => number; state: () => RngState } {
  let s = rng;
  return {
    int: (n) => {
      const r = nextInt(s, n);
      s = r.state;
      return r.value;
    },
    state: () => s,
  };
}

export function createRunningCountDrill(
  system: CountingSystem,
  rng: RngState,
  options: { readonly cards: number; readonly decks?: number },
): { drill: RunningCountDrill; rng: RngState } {
  const decks = options.decks ?? Math.max(1, Math.ceil(options.cards / CARDS_PER_DECK));
  const shuffled = shuffle(createCards(decks), rng);
  const cards = shuffled.items.slice(0, options.cards);
  return { drill: { kind: 'running', cards, answer: runningCount(system, cards) }, rng: shuffled.state };
}

export function createTrueCountDrill(rng: RngState, decks: number): { drill: TrueCountDrill; rng: RngState } {
  const p = picker(rng);
  const decksRemaining = (p.int(decks * 2) + 1) / 2;
  const runningCount = p.int(41) - 20;
  return {
    drill: { kind: 'trueCount', runningCount, decksRemaining, answer: flooredTrueCount(runningCount, decksRemaining) },
    rng: p.state(),
  };
}

export function createCountdownDrill(
  system: CountingSystem,
  rng: RngState,
  removeCount = 1,
): { drill: CountdownDrill; rng: RngState } {
  const shuffled = shuffle(createCards(1), rng);
  const removed = shuffled.items.slice(0, removeCount);
  const cards = shuffled.items.slice(removeCount);
  return {
    drill: { kind: 'countdown', cards, removed, answer: runningCount(system, cards) },
    rng: shuffled.state,
  };
}

const RANK_FOR: Readonly<Record<number, Rank>> = { 1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: 'K' };

/** Picks an index play and a true count within three of its index, so both sides come up. */
export function createDeviationDrill(
  system: CountingSystem,
  rules: RuleSet,
  rng: RngState,
): { drill: DeviationDrill; rng: RngState } {
  const p = picker(rng);
  const plays = indexPlaysFor(rules);
  const play = plays[p.int(plays.length)];
  if (!play) throw new Error('no index plays for these rules');
  const trueCount = play.index + p.int(7) - 3;

  let id = 0;
  const card = (v: CardValue): Card => ({ id: id++, rank: RANK_FOR[v] ?? 'A', suit: SUITS[p.int(4)] ?? 'spades' });
  let values: CardValue[];
  if (play.kind === 'pair') values = [play.value as CardValue, play.value as CardValue];
  else if (play.kind === 'insurance') values = [10, 7];
  else {
    // Two different non-ace cards making the hard total; 10 v X can't be a pair either.
    const options: CardValue[][] = [];
    for (let a = 2; a <= 10; a++) {
      const b = play.value - a;
      if (b > a && b <= 10) options.push([a as CardValue, b as CardValue]);
    }
    values = options[p.int(options.length)] ?? [2, 3];
  }
  const cards = values.map(card);
  const upcard = card(play.up);

  const available: PlayerMove[] = ['hit', 'stand', 'double'];
  if (play.kind === 'pair') available.push('split');
  if (rules.surrender !== 'none') available.push('surrender');

  const answer =
    play.kind === 'insurance'
      ? shouldInsure(system, trueCount)
        ? 'insure'
        : 'decline'
      : recommendPlay({ cards, dealerUpcard: upcard, rules, available, trueCount }).move;
  return { drill: { kind: 'deviation', play, cards, upcard, trueCount, available, answer }, rng: p.state() };
}

export function gradeCountingDrill(drill: CountingDrill, answer: number | string): boolean {
  return drill.answer === answer;
}
