import { cardValue, type Card, type CardValue } from './cards';
import { doubleRuleAllows, type PlayerMove } from './game';
import type { RuleSet } from './rules';

/**
 * Expected-value calculator for a single decision.
 *
 * Everything is computed from the actual shoe composition (the player's cards and the
 * dealer's upcard removed), so it works for any deck count. Two standard simplifications
 * keep it fast enough to run on every click:
 *  - when hitting, the dealer's outcome distribution is not re-adjusted for each card the
 *    player draws (doubles, which draw exactly one card, are computed exactly);
 *  - a split is valued as two independent hands with no further resplits.
 * Both shift EVs by a few thousandths at most, which never matters for teaching and only
 * matters for the very closest composition-dependent plays.
 *
 * EVs are in units of the original bet. In peek games (without early surrender) the
 * dealer has already shown no blackjack before any decision, so EVs are conditional on that.
 */

/** Count of each value left in the shoe; index 0 = aces ... index 9 = ten-value cards. */
export type Composition = readonly number[];

export function fullComposition(decks: number): number[] {
  return [4, 4, 4, 4, 4, 4, 4, 4, 4, 16].map((n) => n * decks);
}

export function removeFromComposition(comp: Composition, cards: readonly (Pick<Card, 'rank'> | CardValue)[]): number[] {
  const out = [...comp];
  for (const c of cards) {
    const v = typeof c === 'number' ? c : cardValue(c);
    const i = v - 1;
    if ((out[i] ?? 0) <= 0) throw new RangeError(`composition has no ${v}s left`);
    out[i] = (out[i] ?? 0) - 1;
  }
  return out;
}

export interface MoveEV {
  readonly move: PlayerMove;
  readonly ev: number;
}

export interface EvaluateInput {
  readonly cards: readonly Pick<Card, 'rank'>[];
  readonly dealerUpcard: Pick<Card, 'rank'> | CardValue;
  readonly rules: RuleSet;
  readonly available: readonly PlayerMove[];
  /** Shoe composition before removing the player's cards and the upcard. Defaults to a full shoe. */
  readonly composition?: Composition;
}

// Dealer outcomes: 17..21 at indices 0..4, bust at 5.
const BUST = 5;
type DealerDist = Float64Array;

const best = (hard: number, ace: boolean): number => (ace && hard + 10 <= 21 ? hard + 10 : hard);
/** 16^i: one 4-bit digit per card value in a removed-cards key. */
const DIGIT = Array.from({ length: 10 }, (_, i) => 16 ** i);
const total = (comp: Composition): number => comp.reduce((a, b) => a + b, 0);

interface DealerOutcome {
  readonly dist: DealerDist;
  readonly pNatural: number;
}

// Many decisions share a shoe composition (10,6 drawing a 5 leaves the same shoe as
// 10,5 drawing a 6), so finished dealer distributions are kept in a small LRU.
const DEALER_CACHE_LIMIT = 4096;
const dealerCache = new Map<string, DealerOutcome>();

function dealerDistribution(up: CardValue, comp: Composition, hitSoft17: boolean): DealerOutcome {
  const key = `${up}${hitSoft17 ? 'h' : 's'}${comp.join(',')}`;
  const hit = dealerCache.get(key);
  if (hit) {
    dealerCache.delete(key);
    dealerCache.set(key, hit);
    return hit;
  }
  const result = computeDealerDistribution(up, comp, hitSoft17);
  if (dealerCache.size >= DEALER_CACHE_LIMIT) dealerCache.delete(dealerCache.keys().next().value ?? '');
  dealerCache.set(key, result);
  return result;
}

function computeDealerDistribution(up: CardValue, comp: Composition, hitSoft17: boolean): DealerOutcome {
  const memo = new Map<number, DealerDist>();

  // Memo keys encode the cards removed from `comp` (4 bits per value), plus hard total and ace flag.
  const play = (hard: number, ace: boolean, c: number[], removed: number): DealerDist => {
    const t = best(hard, ace);
    const soft = ace && hard + 10 <= 21;
    const out = new Float64Array(6);
    if (t > 21) {
      out[BUST] = 1;
      return out;
    }
    if (t >= 17 && !(t === 17 && soft && hitSoft17)) {
      out[t - 17] = 1;
      return out;
    }
    const key = removed * 64 + hard * 2 + (ace ? 1 : 0);
    const cached = memo.get(key);
    if (cached) return cached;
    const n = total(c);
    for (let i = 0; i < 10; i++) {
      const k = c[i] ?? 0;
      if (k === 0) continue;
      c[i] = k - 1;
      const sub = play(hard + i + 1, ace || i === 0, c, removed + (DIGIT[i] ?? 0));
      c[i] = k;
      const p = k / n;
      for (let j = 0; j < 6; j++) out[j] = (out[j] ?? 0) + p * (sub[j] ?? 0);
    }
    memo.set(key, out);
    return out;
  };

  // Hole card, conditioned on the dealer not having a natural.
  const c = [...comp];
  const n = total(c);
  const dist = new Float64Array(6);
  let pNatural = 0;
  for (let i = 0; i < 10; i++) {
    const k = c[i] ?? 0;
    if (k === 0) continue;
    const v = i + 1;
    const p = k / n;
    if ((up === 1 && v === 10) || (up === 10 && v === 1)) {
      pNatural += p;
      continue;
    }
    c[i] = k - 1;
    const sub = play(up + v, up === 1 || v === 1, c, DIGIT[i] ?? 0);
    c[i] = k;
    for (let j = 0; j < 6; j++) dist[j] = (dist[j] ?? 0) + p * (sub[j] ?? 0);
  }
  for (let j = 0; j < 6; j++) dist[j] = (dist[j] ?? 0) / (1 - pNatural);
  return { dist, pNatural };
}

export function evaluateMoves(input: EvaluateInput): MoveEV[] {
  const { rules, available } = input;
  const up = typeof input.dealerUpcard === 'number' ? input.dealerUpcard : cardValue(input.dealerUpcard);
  const values = input.cards.map(cardValue);
  const comp = removeFromComposition(input.composition ?? fullComposition(rules.decks), [...values, up]);
  const { dist, pNatural } = dealerDistribution(up, comp, rules.dealerHitsSoft17);

  const standVs = (t: number, d: DealerDist): number => {
    if (t > 21) return -1;
    let ev = d[BUST] ?? 0;
    for (let x = 17; x <= 21; x++) {
      const p = d[x - 17] ?? 0;
      if (t > x) ev += p;
      else if (t < x) ev -= p;
    }
    return ev;
  };
  const standEV = (t: number): number => standVs(t, dist);

  const hitMemo = new Map<string, number>();
  /** EV of hitting now and then playing hit/stand optimally. */
  const hitEV = (hard: number, ace: boolean, c: number[]): number => {
    const key = `${hard}${ace ? 'a' : ''}|${c.join(',')}`;
    const cached = hitMemo.get(key);
    if (cached !== undefined) return cached;
    const n = total(c);
    let ev = 0;
    for (let i = 0; i < 10; i++) {
      const k = c[i] ?? 0;
      if (k === 0) continue;
      const h = hard + i + 1;
      const a = ace || i === 0;
      let v: number;
      if (h > 21) v = -1;
      else {
        c[i] = k - 1;
        const t = best(h, a);
        v = t === 21 ? standEV(21) : Math.max(standEV(t), hitEV(h, a, c));
        c[i] = k;
      }
      ev += (k / n) * v;
    }
    hitMemo.set(key, ev);
    return ev;
  };

  /**
   * Doubling draws exactly one card, so the dealer's distribution can cheaply be
   * recomputed without it. That makes double EVs exact, which matters in single deck.
   */
  const doubleEV = (hard: number, ace: boolean, c: number[]): number => {
    const n = total(c);
    let ev = 0;
    for (let i = 0; i < 10; i++) {
      const k = c[i] ?? 0;
      if (k === 0) continue;
      c[i] = k - 1;
      const after = dealerDistribution(up, c, rules.dealerHitsSoft17).dist;
      c[i] = k;
      ev += (k / n) * standVs(best(hard + i + 1, ace || i === 0), after);
    }
    return 2 * ev;
  };

  const hard0 = values.reduce<number>((a, b) => a + b, 0);
  const ace0 = values.includes(1);

  const splitEV = (): number => {
    const v = values[0] ?? 1;
    const splitAces = v === 1;
    const c = [...comp];
    const n = total(c);
    let ev = 0;
    for (let i = 0; i < 10; i++) {
      const k = c[i] ?? 0;
      if (k === 0) continue;
      const second = i + 1;
      const hard = v + second;
      const ace = splitAces || second === 1;
      c[i] = k - 1;
      let hv: number;
      if (splitAces && !rules.hitSplitAces) {
        hv = standEV(best(hard, ace));
      } else {
        const t = best(hard, ace);
        hv = Math.max(standEV(t), t === 21 ? -Infinity : hitEV(hard, ace, c));
        const handCards: CardValue[] = [v, second as CardValue];
        if (rules.doubleAfterSplit && doubleRuleAllows(rules, handCards.map(rankOf))) {
          hv = Math.max(hv, doubleEV(hard, ace, c));
        }
      }
      c[i] = k;
      ev += (k / n) * hv;
    }
    return 2 * ev;
  };

  // In a peek game the dealer natural is already ruled out, unless early surrender
  // lets the player act before the peek.
  const decisionBeforeNatural = rules.holeCard !== 'peek' || rules.surrender === 'early';
  const pBJ = decisionBeforeNatural ? pNatural : 0;
  const lossToNatural = (move: PlayerMove): number => {
    if (move === 'surrender') return -0.5;
    if ((move === 'double' || move === 'split') && rules.holeCard === 'enhc') return -2;
    return -1;
  };

  const noBJ: Record<PlayerMove, () => number> = {
    stand: () => standEV(best(hard0, ace0)),
    hit: () => hitEV(hard0, ace0, [...comp]),
    double: () => doubleEV(hard0, ace0, [...comp]),
    split: splitEV,
    surrender: () => -0.5,
  };

  return available
    .map((move): MoveEV => ({ move, ev: pBJ * lossToNatural(move) + (1 - pBJ) * noBJ[move]() }))
    .sort((a, b) => b.ev - a.ev);
}

const RANK_FOR_VALUE = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;
const rankOf = (v: CardValue): Pick<Card, 'rank'> => ({ rank: RANK_FOR_VALUE[v - 1] ?? '10' });

/** How much EV (in units of the original bet) a move gives up versus the best available one. */
export function evCost(evs: readonly MoveEV[], move: PlayerMove): number {
  const top = evs[0]?.ev ?? 0;
  const chosen = evs.find((e) => e.move === move)?.ev ?? top;
  return Math.max(0, top - chosen);
}
