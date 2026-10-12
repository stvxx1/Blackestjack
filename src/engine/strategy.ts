import { cardValue, type Card, type CardValue, type Rank } from './cards';
import { evaluateMoves, fullComposition, removeFromComposition } from './ev';
import { doubleRuleAllows, type PlayerMove } from './game';
import { handTotal, pairValue } from './hand';
import type { RuleSet } from './rules';

/**
 * Chart codes, as on a printed strategy card:
 *   H  hit             S  stand            P  split
 *   D  double, else hit                    Ds double, else stand
 *   Ph split if double-after-split is allowed, else hit
 *   Rh / Rs / Rp  surrender, else hit / stand / split
 */
export type StrategyCode = 'H' | 'S' | 'P' | 'D' | 'Ds' | 'Ph' | 'Rh' | 'Rs' | 'Rp';

/** Dealer upcards in chart column order: 2..10 then ace. */
export const UPCARDS: readonly CardValue[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 1];

export type ChartRow = readonly StrategyCode[];

export interface StrategyChart {
  /** Keyed by hard total, 4-21. */
  readonly hard: ReadonlyMap<number, ChartRow>;
  /** Keyed by soft total, 13-21 (A,2 through A,10). */
  readonly soft: ReadonlyMap<number, ChartRow>;
  /** Keyed by the pair's card value (1 = aces). 5,5 is absent: play it as hard 10. */
  readonly pairs: ReadonlyMap<CardValue, ChartRow>;
}

const row = (codes: string): StrategyCode[] => codes.trim().split(/\s+/) as StrategyCode[];
const all = (code: StrategyCode): StrategyCode[] => Array<StrategyCode>(10).fill(code);

// Base: 4-8 decks, dealer stands on soft 17, peek, double after split, no surrender.
//                    2  3  4  5  6  7  8  9  10 A
const BASE_HARD: [number, StrategyCode[]][] = [
  [9,  row('H  D  D  D  D  H  H  H  H  H')],
  [10, row('D  D  D  D  D  D  D  D  H  H')],
  [11, row('D  D  D  D  D  D  D  D  D  H')],
  [12, row('H  H  S  S  S  H  H  H  H  H')],
  [13, row('S  S  S  S  S  H  H  H  H  H')],
  [14, row('S  S  S  S  S  H  H  H  H  H')],
  [15, row('S  S  S  S  S  H  H  H  H  H')],
  [16, row('S  S  S  S  S  H  H  H  H  H')],
];

const BASE_SOFT: [number, StrategyCode[]][] = [
  [13, row('H  H  H  D  D  H  H  H  H  H')],
  [14, row('H  H  H  D  D  H  H  H  H  H')],
  [15, row('H  H  D  D  D  H  H  H  H  H')],
  [16, row('H  H  D  D  D  H  H  H  H  H')],
  [17, row('H  D  D  D  D  H  H  H  H  H')],
  [18, row('S  Ds Ds Ds Ds S  S  H  H  H')],
  [19, all('S')],
  [20, all('S')],
  [21, all('S')],
];

const BASE_PAIRS: [CardValue, StrategyCode[]][] = [
  [1,  all('P')],
  [2,  row('Ph Ph P  P  P  P  H  H  H  H')],
  [3,  row('Ph Ph P  P  P  P  H  H  H  H')],
  [4,  row('H  H  H  Ph Ph H  H  H  H  H')],
  [6,  row('Ph P  P  P  P  H  H  H  H  H')],
  [7,  row('P  P  P  P  P  P  H  H  H  H')],
  [8,  all('P')],
  [9,  row('P  P  P  P  P  S  P  P  S  S')],
  [10, all('S')],
];

const col = (up: CardValue): number => (up === 1 ? 9 : up - 2);

type MutableChart = {
  hard: Map<number, StrategyCode[]>;
  soft: Map<number, StrategyCode[]>;
  pairs: Map<CardValue, StrategyCode[]>;
};

function set<K>(table: Map<K, StrategyCode[]>, key: K, up: CardValue, code: StrategyCode): void {
  const r = table.get(key);
  if (r) r[col(up)] = code;
}

function baseChart(): MutableChart {
  const hard = new Map<number, StrategyCode[]>();
  for (let t = 4; t <= 8; t++) hard.set(t, all('H'));
  for (const [t, r] of BASE_HARD) hard.set(t, [...r]);
  for (let t = 17; t <= 21; t++) hard.set(t, all('S'));
  return {
    hard,
    soft: new Map(BASE_SOFT.map(([t, r]) => [t, [...r]])),
    pairs: new Map(BASE_PAIRS.map(([v, r]) => [v, [...r]])),
  };
}

function buildChart(rules: RuleSet): StrategyChart {
  const c = baseChart();

  if (rules.dealerHitsSoft17) {
    set(c.hard, 11, 1, 'D');
    set(c.soft, 18, 2, 'Ds');
    set(c.soft, 19, 6, 'Ds');
  }

  if (rules.surrender !== 'none') {
    set(c.hard, 15, 10, 'Rh');
    set(c.hard, 16, 9, 'Rh');
    set(c.hard, 16, 10, 'Rh');
    set(c.hard, 16, 1, 'Rh');
    if (rules.dealerHitsSoft17) {
      set(c.hard, 15, 1, 'Rh');
      set(c.hard, 17, 1, 'Rs');
      set(c.pairs, 8, 1, 'Rp');
    }
  }

  if (rules.surrender === 'early') {
    // Surrendering before the peek is worth far more against an ace or ten.
    for (const t of [5, 6, 7, 12, 13, 14, 15, 16]) set(c.hard, t, 1, 'Rh');
    set(c.hard, 17, 1, 'Rs');
    for (const t of [14, 15, 16]) set(c.hard, t, 10, 'Rh');
    for (const v of [3, 6, 7] as const) set(c.pairs, v, 1, 'Rh');
    set(c.pairs, 7, 10, 'Rh');
    set(c.pairs, 8, 1, 'Rp');
    set(c.pairs, 8, 10, 'Rp');
  }

  if (rules.holeCard === 'enhc') {
    // No hole card and doubles/splits lost to a dealer natural: don't add money vs 10 or A.
    set(c.hard, 11, 10, 'H');
    set(c.hard, 11, 1, 'H');
    set(c.pairs, 1, 1, 'H');
    set(c.pairs, 8, 10, rules.surrender === 'none' ? 'H' : 'Rh');
    set(c.pairs, 8, 1, rules.surrender === 'none' ? 'H' : 'Rh');
  }

  return c;
}

/** Where a rule set's chart comes from. */
export type ChartSource = 'tables' | 'computed';

/**
 * 4-8 deck games use the classic tables (verified cell-by-cell against the EV solver in
 * the test suite). Single- and double-deck strategy shifts with every card removed, so
 * those charts are computed from the solver, weighting each two-card hand by how often
 * it is dealt.
 */
export function chartSource(rules: RuleSet): ChartSource {
  return rules.decks >= 4 ? 'tables' : 'computed';
}

const CACHE_LIMIT = 16;
const chartCache = new Map<string, StrategyChart>();

/** The full chart for a rule set, ready for display or lookup. Cached per rule values. */
export function strategyChart(rules: RuleSet): StrategyChart {
  const key = JSON.stringify({ ...rules, name: '', minBet: 0, maxBet: 0, penetration: 0, burnCards: 0 });
  let chart = chartCache.get(key);
  if (!chart) {
    chart = chartSource(rules) === 'tables' ? buildChart(rules) : computeChart(rules);
    if (chartCache.size >= CACHE_LIMIT) chartCache.delete(chartCache.keys().next().value ?? '');
    chartCache.set(key, chart);
  }
  return chart;
}

type Pair = readonly [CardValue, CardValue];
const RANK_OF: Readonly<Record<CardValue, Rank>> = { 1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10' };

function computeChart(rules: RuleSet): StrategyChart {
  const hardCombos = new Map<number, Pair[]>();
  const softCombos = new Map<number, Pair[]>();
  for (let a = 2; a <= 10; a++) {
    for (let b = a + 1; b <= 10; b++) {
      const t = a + b;
      hardCombos.set(t, [...(hardCombos.get(t) ?? []), [a, b] as Pair]);
    }
  }
  // Hard 4 and hard 20 only arise from pairs; chart them as unsplittable pairs.
  hardCombos.set(4, [[2, 2]]);
  hardCombos.set(20, [[10, 10]]);
  for (let x = 2; x <= 10; x++) softCombos.set(11 + x, [[1, x as CardValue]]);

  const solveRow = (combos: readonly Pair[], allowSplit: boolean): StrategyCode[] =>
    UPCARDS.map((up) => solveCell(rules, combos, up, allowSplit));

  const hard = new Map<number, StrategyCode[]>();
  for (let t = 4; t <= 20; t++) {
    const combos = hardCombos.get(t);
    hard.set(t, combos ? solveRow(combos, false) : all('H'));
  }
  hard.set(21, all('S'));
  const soft = new Map<number, StrategyCode[]>();
  for (const [t, combos] of softCombos) soft.set(t, solveRow(combos, false));
  soft.set(21, all('S'));
  const pairs = new Map<CardValue, StrategyCode[]>();
  for (let v = 1; v <= 10; v++) {
    if (v !== 5) pairs.set(v as CardValue, solveRow([[v as CardValue, v as CardValue]], true));
  }
  return { hard, soft, pairs };
}

function solveCell(rules: RuleSet, combos: readonly Pair[], up: CardValue, allowSplit: boolean): StrategyCode {
  const comp = removeFromComposition(fullComposition(rules.decks), [up]);
  const totals = new Map<PlayerMove, number>();
  let weightSum = 0;
  for (const [a, b] of combos) {
    const na = comp[a - 1] ?? 0;
    const nb = (comp[b - 1] ?? 0) - (a === b ? 1 : 0);
    const weight = na * nb * (a === b ? 1 : 2);
    if (weight <= 0) continue;
    const hand = [{ rank: RANK_OF[a] }, { rank: RANK_OF[b] }];
    const available: PlayerMove[] = ['hit', 'stand'];
    if (doubleRuleAllows(rules, hand)) available.push('double');
    if (allowSplit) available.push('split');
    if (rules.surrender !== 'none') available.push('surrender');
    for (const { move, ev } of evaluateMoves({ cards: hand, dealerUpcard: up, rules, available })) {
      totals.set(move, (totals.get(move) ?? 0) + weight * ev);
    }
    weightSum += weight;
  }
  const ranked = [...totals].map(([move, ev]) => ({ move, ev: ev / weightSum })).sort((x, y) => y.ev - x.ev);
  const bestOf = (moves: readonly PlayerMove[]): PlayerMove =>
    ranked.find((r) => moves.includes(r.move))?.move ?? 'stand';

  const top = ranked[0]?.move ?? 'stand';
  switch (top) {
    case 'hit':
      return 'H';
    case 'stand':
      return 'S';
    case 'split':
      return 'P';
    case 'double':
      return bestOf(['hit', 'stand']) === 'hit' ? 'D' : 'Ds';
    case 'surrender': {
      const fallback = bestOf(['hit', 'stand', 'split']);
      return fallback === 'hit' ? 'Rh' : fallback === 'stand' ? 'Rs' : 'Rp';
    }
  }
}

export interface StrategyInput {
  readonly cards: readonly Pick<Card, 'rank'>[];
  readonly dealerUpcard: Pick<Card, 'rank'> | CardValue;
  readonly rules: RuleSet;
  /** Moves actually available right now. A chart code resolves to the best of these. */
  readonly available: readonly PlayerMove[];
}

export interface StrategyAdvice {
  readonly move: PlayerMove;
  readonly code: StrategyCode;
  readonly table: 'hard' | 'soft' | 'pairs';
}

export function chartLookup(
  chart: StrategyChart,
  cards: readonly Pick<Card, 'rank'>[],
  up: CardValue,
  allowSplit: boolean,
): { code: StrategyCode; table: StrategyAdvice['table'] } {
  const pv = allowSplit ? pairValue(cards) : null;
  const pairRow = pv !== null ? chart.pairs.get(pv) : undefined;
  if (pairRow) return { code: pairRow[col(up)] as StrategyCode, table: 'pairs' };

  const { total, soft } = handTotal(cards);
  const softRow = soft ? chart.soft.get(total) : undefined;
  if (softRow) return { code: softRow[col(up)] as StrategyCode, table: 'soft' };

  const hardRow = chart.hard.get(Math.min(Math.max(total, 4), 21));
  return { code: (hardRow?.[col(up)] ?? 'S'), table: 'hard' };
}

/** The basic-strategy move for this hand, restricted to what the table currently allows. */
export function basicStrategy(input: StrategyInput): StrategyAdvice {
  const { rules, available } = input;
  const up = typeof input.dealerUpcard === 'number' ? input.dealerUpcard : cardValue(input.dealerUpcard);
  const can = (m: PlayerMove): boolean => available.includes(m);
  const chart = strategyChart(rules);

  const { code, table } = chartLookup(chart, input.cards, up, can('split'));
  const resolve = (move: PlayerMove): StrategyAdvice => ({ move, code, table });

  // Split aces may be unhittable; standing is then the only alternative.
  const hitOr = (fallback: PlayerMove): StrategyAdvice => resolve(can('hit') ? 'hit' : fallback);

  switch (code) {
    case 'H':
      return hitOr('stand');
    case 'S':
      return resolve('stand');
    case 'D':
      return can('double') ? resolve('double') : hitOr('stand');
    case 'Ds':
      return can('double') ? resolve('double') : resolve('stand');
    case 'P':
      return resolve('split');
    case 'Ph':
      return rules.doubleAfterSplit ? resolve('split') : hitOr('stand');
    case 'Rh':
      return can('surrender') ? resolve('surrender') : hitOr('stand');
    case 'Rs':
      return can('surrender') ? resolve('surrender') : resolve('stand');
    case 'Rp':
      return can('surrender') ? resolve('surrender') : resolve('split');
  }
}
