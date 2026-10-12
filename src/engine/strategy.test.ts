import { describe, expect, it } from 'vitest';
import { RANKS, type CardValue, type Rank } from './cards';
import type { PlayerMove } from './game';
import { AU_CASINO, ATLANTIC_CITY, VEGAS_DOWNTOWN_H17, VEGAS_STRIP, type RuleSet } from './rules';
import { basicStrategy, chartIsExactFor, strategyChart, UPCARDS } from './strategy';
import { cards } from './test-utils';

const FRESH: readonly PlayerMove[] = ['hit', 'stand', 'double', 'split', 'surrender'];
const NO_SURRENDER: readonly PlayerMove[] = ['hit', 'stand', 'double', 'split'];

function advise(rules: RuleSet, hand: Rank[], up: CardValue, available: readonly PlayerMove[] = FRESH): PlayerMove {
  return basicStrategy({ cards: cards(...hand), dealerUpcard: up, rules, available }).move;
}

describe('basic strategy: Vegas Strip (6D S17 DAS LS)', () => {
  const r = VEGAS_STRIP;
  it.each([
    [['10', '6'], 10, 'surrender'],
    [['10', '6'], 7, 'hit'],
    [['10', '5'], 10, 'surrender'],
    [['10', '5'], 1, 'hit'],
    [['10', '2'], 2, 'hit'],
    [['10', '2'], 4, 'stand'],
    [['7', '6'], 2, 'stand'],
    [['6', '5'], 1, 'hit'],
    [['6', '5'], 10, 'double'],
    [['6', '4'], 9, 'double'],
    [['5', '4'], 2, 'hit'],
    [['5', '4'], 3, 'double'],
    [['5', '5'], 9, 'double'],
    [['A', '7'], 2, 'stand'],
    [['A', '7'], 3, 'double'],
    [['A', '7'], 9, 'hit'],
    [['A', '8'], 6, 'stand'],
    [['A', '2'], 5, 'double'],
    [['A', '2'], 4, 'hit'],
    [['A', 'A'], 1, 'split'],
    [['8', '8'], 1, 'split'],
    [['8', '8'], 10, 'split'],
    [['9', '9'], 7, 'stand'],
    [['9', '9'], 8, 'split'],
    [['K', 'Q'], 6, 'stand'],
    [['2', '2'], 2, 'split'],
    [['4', '4'], 5, 'split'],
    [['6', '6'], 2, 'split'],
    [['7', '7'], 8, 'hit'],
  ] as const)('%j vs %i -> %s', (hand, up, move) => {
    expect(advise(r, [...hand], up)).toBe(move);
  });

  it('falls back when a move is unavailable', () => {
    expect(advise(r, ['A', '7'], 3, ['hit', 'stand'])).toBe('stand'); // Ds -> stand
    expect(advise(r, ['6', '5'], 10, ['hit', 'stand'])).toBe('hit'); // D -> hit
    expect(advise(r, ['10', '6'], 10, NO_SURRENDER)).toBe('hit'); // Rh -> hit
    expect(advise(r, ['8', '8'], 6, ['hit', 'stand', 'double'])).toBe('stand'); // can't split: hard 16
    expect(advise(r, ['A', 'A'], 6, ['stand'])).toBe('stand'); // split aces, one card only
  });

  it('plays three-card hands by total', () => {
    expect(advise(r, ['5', '4', '2'], 10, ['hit', 'stand'])).toBe('hit');
    expect(advise(r, ['2', '2', 'A', '3'], 5, ['hit', 'stand'])).toBe('stand'); // soft 18: Ds without the double
    expect(advise(r, ['2', '2', 'A', '3'], 9, ['hit', 'stand'])).toBe('hit');
  });
});

describe('rule adjustments', () => {
  it('H17 doubles 11 vs A, A,8 vs 6, and surrenders more', () => {
    const r = VEGAS_DOWNTOWN_H17;
    expect(advise(r, ['6', '5'], 1)).toBe('double');
    expect(advise(r, ['A', '8'], 6)).toBe('double');
    expect(advise(r, ['A', '7'], 2)).toBe('double');
    expect(advise(r, ['10', '5'], 1)).toBe('surrender');
    expect(advise(r, ['10', '7'], 1)).toBe('surrender');
    expect(advise(r, ['10', '7'], 1, NO_SURRENDER)).toBe('stand');
    expect(advise(r, ['8', '8'], 1)).toBe('surrender');
    expect(advise(r, ['8', '8'], 1, NO_SURRENDER)).toBe('split');
  });

  it('without DAS, only splits low pairs where it pays on its own', () => {
    const r = { ...ATLANTIC_CITY, doubleAfterSplit: false };
    expect(advise(r, ['2', '2'], 2)).toBe('hit');
    expect(advise(r, ['2', '2'], 4)).toBe('split');
    expect(advise(r, ['4', '4'], 5)).toBe('hit');
    expect(advise(r, ['6', '6'], 2)).toBe('hit');
    expect(advise(ATLANTIC_CITY, ['6', '6'], 2)).toBe('split');
  });

  it('early surrender gives up much more vs A and 10', () => {
    const r: RuleSet = { ...VEGAS_STRIP, surrender: 'early' };
    expect(advise(r, ['4', '3'], 1)).toBe('surrender');
    expect(advise(r, ['10', '4'], 10)).toBe('surrender');
    expect(advise(r, ['10', '7'], 1)).toBe('surrender');
    expect(advise(r, ['8', '8'], 10)).toBe('surrender');
    expect(advise(r, ['8', '8'], 10, NO_SURRENDER)).toBe('split');
    expect(advise(r, ['10', '4'], 9)).toBe('hit');
  });

  it('Australian no-hole-card: no doubling or splitting into a 10 or ace', () => {
    const r = AU_CASINO;
    expect(advise(r, ['6', '5'], 10)).toBe('hit');
    expect(advise(r, ['6', '5'], 1)).toBe('hit');
    expect(advise(r, ['6', '5'], 9)).toBe('double');
    expect(advise(r, ['8', '8'], 10)).toBe('hit');
    expect(advise(r, ['8', '8'], 1)).toBe('hit');
    expect(advise(r, ['8', '8'], 9)).toBe('split');
    expect(advise(r, ['A', 'A'], 1)).toBe('hit');
    expect(advise(r, ['A', 'A'], 10)).toBe('split');
    expect(advise(r, ['10', '6'], 10)).toBe('hit'); // no surrender in AU_CASINO
  });

  it('no-hole-card with original-bets-only plays like a peek game', () => {
    const r: RuleSet = { ...AU_CASINO, holeCard: 'enhc-obo' };
    expect(advise(r, ['6', '5'], 10)).toBe('double');
    expect(advise(r, ['8', '8'], 1)).toBe('split');
  });
});

describe('chart completeness', () => {
  it.each([AU_CASINO, VEGAS_STRIP, ATLANTIC_CITY, VEGAS_DOWNTOWN_H17])('$name: every two-card hand resolves to an available move', (rules) => {
    const chart = strategyChart(rules);
    expect([...chart.hard.keys()]).toEqual(Array.from({ length: 18 }, (_, i) => i + 4));
    for (const rowCodes of [...chart.hard.values(), ...chart.soft.values(), ...chart.pairs.values()]) {
      expect(rowCodes).toHaveLength(10);
    }
    for (const a of RANKS) {
      for (const b of RANKS) {
        for (const up of UPCARDS) {
          for (const available of [FRESH, NO_SURRENDER, ['hit', 'stand'] as const]) {
            expect(available).toContain(advise(rules, [a, b], up, available));
          }
        }
      }
    }
  });

  it('caches charts per rule set', () => {
    expect(strategyChart(VEGAS_STRIP)).toBe(strategyChart(VEGAS_STRIP));
  });

  it('flags single- and double-deck games as approximate', () => {
    expect(chartIsExactFor(VEGAS_STRIP)).toBe(true);
    expect(chartIsExactFor({ ...VEGAS_STRIP, decks: 2 })).toBe(false);
  });

  it('accepts a card as the upcard', () => {
    expect(basicStrategy({ cards: cards('10', '6'), dealerUpcard: { rank: 'K' }, rules: VEGAS_STRIP, available: FRESH }).move).toBe('surrender');
  });
});
