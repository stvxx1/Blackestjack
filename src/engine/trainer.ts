import { SUITS, type Card, type CardValue, type Rank } from './cards';
import { evaluateMoves, evCost, type MoveEV } from './ev';
import { doubleRuleAllows, type PlayerMove } from './game';
import { nextInt, type RngState } from './rng';
import type { RuleSet } from './rules';
import { basicStrategy, UPCARDS, type StrategyAdvice } from './strategy';

/** Basic-strategy flash drills with weakness-weighted hand selection. */

export type DrillCategory = 'all' | 'hard' | 'soft' | 'pairs';

export interface DrillHand {
  readonly cards: readonly Card[];
  readonly upcard: Card;
  readonly available: readonly PlayerMove[];
  /** Chart cell, e.g. `hard:16:10`, `soft:18:2`, `pair:8:1`. */
  readonly cell: string;
}

export interface CellStats {
  readonly attempts: number;
  readonly correct: number;
}

export interface DrillStats {
  readonly attempts: number;
  readonly correct: number;
  readonly streak: number;
  readonly bestStreak: number;
  /** Sum of EV given up by wrong answers, in units of a bet. */
  readonly evLost: number;
  readonly cells: Readonly<Record<string, CellStats>>;
}

export const EMPTY_DRILL_STATS: DrillStats = { attempts: 0, correct: 0, streak: 0, bestStreak: 0, evLost: 0, cells: {} };

export interface DrillGrade {
  readonly correct: boolean;
  readonly answer: PlayerMove;
  readonly expected: StrategyAdvice;
  readonly evs: readonly MoveEV[];
  /** EV given up versus the best play, in units of a bet. */
  readonly cost: number;
}

type Row = { readonly kind: 'hard' | 'soft' | 'pair'; readonly value: number };

const ROWS: Readonly<Record<Exclude<DrillCategory, 'all'>, readonly Row[]>> = {
  // Hard 5-19 from two different cards; 20 and 21 are not decisions worth drilling.
  hard: Array.from({ length: 15 }, (_, i) => ({ kind: 'hard', value: i + 5 })),
  soft: Array.from({ length: 8 }, (_, i) => ({ kind: 'soft', value: i + 13 })),
  pairs: Array.from({ length: 10 }, (_, i) => ({ kind: 'pair', value: i + 1 })),
};

const rowsFor = (category: DrillCategory): readonly Row[] =>
  category === 'all' ? [...ROWS.hard, ...ROWS.soft, ...ROWS.pairs] : ROWS[category];

const cellKey = (row: Row, up: CardValue): string => `${row.kind}:${row.value}:${up}`;

/**
 * Unseen cells get double weight; cells you miss get up to five times the weight
 * of ones you've mastered, so practice drifts toward your leaks.
 */
export function cellWeight(stats: CellStats | undefined): number {
  if (!stats || stats.attempts === 0) return 2;
  const missRate = 1 - stats.correct / stats.attempts;
  return 1 + 4 * missRate;
}

const TEN_RANKS: readonly Rank[] = ['10', 'J', 'Q', 'K'];
const RANK_FOR: Readonly<Record<number, Rank>> = { 1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9' };

export function generateDrillHand(
  rules: RuleSet,
  category: DrillCategory,
  rng: RngState,
  stats: DrillStats = EMPTY_DRILL_STATS,
): { hand: DrillHand; rng: RngState } {
  let s = rng;
  const int = (n: number): number => {
    const r = nextInt(s, n);
    s = r.state;
    return r.value;
  };

  const cells = rowsFor(category).flatMap((row) => UPCARDS.map((up) => ({ row, up, key: cellKey(row, up) })));
  const weights = cells.map((c) => cellWeight(stats.cells[c.key]));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  // Weights are multiples of 1/attempts; scale to integers so selection stays exact.
  const SCALE = 10_000;
  let pick = int(Math.round(totalWeight * SCALE)) / SCALE;
  let chosen = cells[cells.length - 1];
  for (let i = 0; i < cells.length; i++) {
    pick -= weights[i] ?? 0;
    if (pick < 0) {
      chosen = cells[i];
      break;
    }
  }
  if (!chosen) throw new Error('no drill cells');

  let id = 0;
  const card = (value: CardValue): Card => {
    const rank = value === 10 ? (TEN_RANKS[int(4)] ?? '10') : (RANK_FOR[value] ?? 'A');
    return { id: id++, rank, suit: SUITS[int(4)] ?? 'spades' };
  };

  const { row, up } = chosen;
  let values: [CardValue, CardValue];
  if (row.kind === 'pair') values = [row.value as CardValue, row.value as CardValue];
  else if (row.kind === 'soft') values = [1, (row.value - 11) as CardValue];
  else {
    // Two different non-ace values summing to the total.
    const options: [CardValue, CardValue][] = [];
    for (let a = 2; a <= 10; a++) {
      const b = row.value - a;
      if (b > a && b <= 10) options.push([a as CardValue, b as CardValue]);
    }
    values = options[int(options.length)] ?? [2, 3];
  }
  const cards = values.map(card);
  if (int(2) === 1) cards.reverse();

  const available: PlayerMove[] = ['hit', 'stand'];
  if (doubleRuleAllows(rules, cards)) available.push('double');
  if (row.kind === 'pair') available.push('split');
  if (rules.surrender !== 'none') available.push('surrender');

  return { hand: { cards, upcard: card(up), available, cell: chosen.key }, rng: s };
}

export function gradeDrill(rules: RuleSet, hand: DrillHand, answer: PlayerMove): DrillGrade {
  const input = { cards: hand.cards, dealerUpcard: hand.upcard, rules, available: hand.available };
  const expected = basicStrategy(input);
  const evs = evaluateMoves(input);
  const correct = answer === expected.move;
  return { correct, answer, expected, evs, cost: correct ? 0 : evCost(evs, answer) };
}

export function recordDrill(stats: DrillStats, cell: string, grade: Pick<DrillGrade, 'correct' | 'cost'>): DrillStats {
  const prev = stats.cells[cell] ?? { attempts: 0, correct: 0 };
  const streak = grade.correct ? stats.streak + 1 : 0;
  return {
    attempts: stats.attempts + 1,
    correct: stats.correct + (grade.correct ? 1 : 0),
    streak,
    bestStreak: Math.max(stats.bestStreak, streak),
    evLost: stats.evLost + grade.cost,
    cells: { ...stats.cells, [cell]: { attempts: prev.attempts + 1, correct: prev.correct + (grade.correct ? 1 : 0) } },
  };
}

export function accuracy(stats: Pick<DrillStats, 'attempts' | 'correct'>): number {
  return stats.attempts === 0 ? 0 : stats.correct / stats.attempts;
}
