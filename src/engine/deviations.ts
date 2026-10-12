import { cardValue, type Card, type CardValue } from './cards';
import type { CountingSystem } from './counting';
import type { PlayerMove } from './game';
import { handTotal, isPair } from './hand';
import type { RuleSet } from './rules';
import { basicStrategy, type StrategyAdvice } from './strategy';

/**
 * Hi-Lo index plays: the Illustrious 18 and the Fab 4 surrenders (Schlesinger), for
 * 4-8 decks, dealer stands on soft 17. At a floored true count >= `index` the player
 * makes `atOrAbove`; below it, `below`.
 */
export interface IndexPlay {
  readonly id: string;
  readonly label: string;
  readonly kind: 'hard' | 'pair' | 'insurance';
  /** Hard total, or the pair's card value for `pair`. Unused for insurance. */
  readonly value: number;
  readonly up: CardValue;
  readonly index: number;
  readonly atOrAbove: PlayerMove | 'insure';
  readonly below: PlayerMove | 'decline';
}

const ip = (
  id: string,
  kind: IndexPlay['kind'],
  value: number,
  up: CardValue,
  index: number,
  atOrAbove: IndexPlay['atOrAbove'],
  below: IndexPlay['below'],
): IndexPlay => {
  const upLabel = up === 1 ? 'A' : String(up);
  const hand = kind === 'insurance' ? 'Insurance' : kind === 'pair' ? `${value === 10 ? 'T' : value},${value === 10 ? 'T' : value}` : String(value);
  return { id, label: `${hand} v ${upLabel}`, kind, value, up, index, atOrAbove, below };
};

export const ILLUSTRIOUS_18: readonly IndexPlay[] = [
  ip('ins', 'insurance', 0, 1, 3, 'insure', 'decline'),
  ip('16v10', 'hard', 16, 10, 0, 'stand', 'hit'),
  ip('15v10', 'hard', 15, 10, 4, 'stand', 'hit'),
  ip('TTv5', 'pair', 10, 5, 5, 'split', 'stand'),
  ip('TTv6', 'pair', 10, 6, 4, 'split', 'stand'),
  ip('10v10', 'hard', 10, 10, 4, 'double', 'hit'),
  ip('12v3', 'hard', 12, 3, 2, 'stand', 'hit'),
  ip('12v2', 'hard', 12, 2, 3, 'stand', 'hit'),
  ip('11vA', 'hard', 11, 1, 1, 'double', 'hit'),
  ip('9v2', 'hard', 9, 2, 1, 'double', 'hit'),
  ip('10vA', 'hard', 10, 1, 4, 'double', 'hit'),
  ip('9v7', 'hard', 9, 7, 3, 'double', 'hit'),
  ip('16v9', 'hard', 16, 9, 5, 'stand', 'hit'),
  ip('13v2', 'hard', 13, 2, -1, 'stand', 'hit'),
  ip('12v4', 'hard', 12, 4, 0, 'stand', 'hit'),
  ip('12v5', 'hard', 12, 5, -2, 'stand', 'hit'),
  ip('12v6', 'hard', 12, 6, -1, 'stand', 'hit'),
  ip('13v3', 'hard', 13, 3, -2, 'stand', 'hit'),
];

/** Surrender indices. `below` is a placeholder: under the index the normal play applies. */
export const FAB_4: readonly IndexPlay[] = [
  ip('R14v10', 'hard', 14, 10, 3, 'surrender', 'hit'),
  ip('R15v10', 'hard', 15, 10, 0, 'surrender', 'hit'),
  ip('R15v9', 'hard', 15, 9, 2, 'surrender', 'hit'),
  ip('R15vA', 'hard', 15, 1, 1, 'surrender', 'hit'),
];

/**
 * The indices are calibrated for multi-deck S17 peek games. They are still close for
 * H17, but doubling and splitting into a 10 or ace means something different without a
 * hole card, so those plays are left out in no-hole-card games.
 */
export function indexPlaysFor(rules: RuleSet): readonly IndexPlay[] {
  const plays = [...ILLUSTRIOUS_18, ...(rules.surrender === 'none' ? [] : FAB_4)];
  if (rules.holeCard !== 'enhc') return plays;
  return plays.filter((p) => !((p.up === 1 || p.up === 10) && (p.atOrAbove === 'double' || p.atOrAbove === 'split')));
}

export interface Recommendation {
  readonly move: PlayerMove;
  readonly basic: StrategyAdvice;
  /** The index play that overrode basic strategy, if any. */
  readonly deviation: IndexPlay | null;
}

export interface RecommendInput {
  readonly cards: readonly Pick<Card, 'rank'>[];
  readonly dealerUpcard: Pick<Card, 'rank'> | CardValue;
  readonly rules: RuleSet;
  readonly available: readonly PlayerMove[];
  /** Floored Hi-Lo true count. Omit to get pure basic strategy. */
  readonly trueCount?: number;
}

function matches(play: IndexPlay, cards: readonly Pick<Card, 'rank'>[], up: CardValue): boolean {
  if (play.up !== up) return false;
  if (play.kind === 'pair') return isPair(cards) && cardValue(cards[0] ?? { rank: 'A' }) === play.value;
  if (play.kind !== 'hard') return false;
  const { total, soft } = handTotal(cards);
  return !soft && total === play.value;
}

/** Basic strategy, overridden by an index play when the true count calls for it. */
export function recommendPlay(input: RecommendInput): Recommendation {
  const basic = basicStrategy(input);
  const tc = input.trueCount;
  if (tc === undefined) return { move: basic.move, basic, deviation: null };

  const up = typeof input.dealerUpcard === 'number' ? input.dealerUpcard : cardValue(input.dealerUpcard);
  const can = (m: PlayerMove): boolean => input.available.includes(m);

  for (const play of indexPlaysFor(input.rules)) {
    if (play.kind === 'insurance' || !matches(play, input.cards, up)) continue;
    // A split pair is governed only by pair indices; e.g. 6,6 v 4 is not a "hard 12" play.
    if (basic.move === 'split' && play.kind !== 'pair') continue;
    if (play.atOrAbove === 'surrender') {
      if (tc >= play.index && can('surrender')) return deviate(basic, play, 'surrender');
      if (tc < play.index && basic.move === 'surrender') {
        // Below a Fab 4 index, play the hand out as if surrender were not offered.
        const without = basicStrategy({ ...input, available: input.available.filter((m) => m !== 'surrender') });
        return deviate(basic, play, without.move);
      }
      continue;
    }
    const target = tc >= play.index ? play.atOrAbove : play.below;
    if (target === 'insure' || target === 'decline' || !can(target) || target === basic.move) continue;
    // Keep a basic-strategy surrender unless a Fab 4 entry above already ruled on it.
    if (basic.move === 'surrender') continue;
    return deviate(basic, play, target);
  }
  return { move: basic.move, basic, deviation: null };
}

const deviate = (basic: StrategyAdvice, play: IndexPlay, move: PlayerMove): Recommendation =>
  move === basic.move ? { move, basic, deviation: null } : { move, basic, deviation: play };

/** Hi-Lo insurance index: insure at a true count of +3 or more. Other systems: never. */
export function shouldInsure(system: CountingSystem, trueCount: number | undefined): boolean {
  return system.id === 'hi-lo' && trueCount !== undefined && trueCount >= 3;
}
