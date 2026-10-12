import { describe, expect, it } from 'vitest';
import type { Rank } from './cards';
import { evaluateMoves, evCost, fullComposition, removeFromComposition } from './ev';
import type { PlayerMove } from './game';
import { AU_CASINO, VEGAS_DOWNTOWN_H17, VEGAS_STRIP, type RuleSet } from './rules';
import { basicStrategy, UPCARDS } from './strategy';
import { cards } from './test-utils';

const evs = (rules: RuleSet, hand: Rank[], up: number, available: PlayerMove[]) =>
  Object.fromEntries(
    evaluateMoves({ cards: cards(...hand), dealerUpcard: up as 1, rules, available }).map((m) => [m.move, m.ev]),
  ) as Record<PlayerMove, number>;

describe('composition', () => {
  it('builds and depletes shoes', () => {
    expect(fullComposition(6)).toEqual([24, 24, 24, 24, 24, 24, 24, 24, 24, 96]);
    expect(removeFromComposition(fullComposition(1), [{ rank: 'K' }, 1])).toEqual([3, 4, 4, 4, 4, 4, 4, 4, 4, 15]);
    expect(() => removeFromComposition([0, 0, 0, 0, 0, 0, 0, 0, 0, 1], [1])).toThrow(RangeError);
  });
});

describe('evaluateMoves', () => {
  it('ranks moves best-first and agrees with well-known values', () => {
    const r = evs(VEGAS_STRIP, ['10', '10'], 6, ['stand', 'hit', 'double', 'split']);
    expect(r.stand).toBeGreaterThan(0.6);
    expect(r.hit).toBeLessThan(-0.8);
    // Hard 16 vs 10 is the famous near coin-flip between two bad options.
    const s16 = evs(VEGAS_STRIP, ['10', '6'], 10, ['stand', 'hit', 'surrender']);
    expect(s16.stand).toBeCloseTo(-0.54, 1);
    expect(s16.hit).toBeCloseTo(-0.54, 1);
    expect(s16.surrender).toBe(-0.5);
  });

  it('values a natural-free 21 at stand as nearly a sure win', () => {
    expect(evs(VEGAS_STRIP, ['A', '5', '5'], 10, ['stand']).stand).toBeGreaterThan(0.85);
  });

  it('charges no-hole-card doubles for the dealer natural risk', () => {
    const peek = evs(VEGAS_STRIP, ['6', '5'], 10, ['hit', 'double']);
    const enhc = evs(AU_CASINO, ['6', '5'], 10, ['hit', 'double']);
    const obo = evs({ ...AU_CASINO, holeCard: 'enhc-obo' }, ['6', '5'], 10, ['hit', 'double']);
    expect(peek.double).toBeGreaterThan(peek.hit);
    expect(enhc.double).toBeLessThan(enhc.hit);
    expect(obo.double).toBeGreaterThan(obo.hit);
    expect(enhc.double).toBeLessThan(obo.double);
  });

  it('early surrender is worth more than late against an ace', () => {
    const late = evs(VEGAS_STRIP, ['10', '6'], 1, ['hit', 'stand', 'surrender']);
    const early = evs({ ...VEGAS_STRIP, surrender: 'early' }, ['10', '6'], 1, ['hit', 'stand', 'surrender']);
    // Before the peek every non-surrender play carries the dealer natural risk.
    expect(early.hit).toBeLessThan(late.hit);
    expect(early.surrender).toBe(-0.5);
  });

  it('respects a custom shoe composition (ten-rich shoe favours insurance-like spots)', () => {
    const tenRich = fullComposition(6).map((n, i) => (i === 9 ? n + 40 : n));
    const neutral = evs(VEGAS_STRIP, ['10', '2'], 3, ['hit', 'stand']);
    const rich = evaluateMoves({ cards: cards('10', '2'), dealerUpcard: 3, rules: VEGAS_STRIP, available: ['hit', 'stand'], composition: tenRich });
    expect(neutral.hit).toBeGreaterThan(neutral.stand);
    expect(rich[0]?.move).toBe('stand');
  });

  it('computes the EV cost of a move', () => {
    const list = evaluateMoves({ cards: cards('6', '5'), dealerUpcard: 6, rules: VEGAS_STRIP, available: ['hit', 'stand', 'double'] });
    expect(evCost(list, 'double')).toBe(0);
    expect(evCost(list, 'stand')).toBeGreaterThan(0.4);
  });
});

/**
 * The 4-8 deck tables were written from the published charts. Here every two-card hand vs
 * every upcard is solved independently and must agree. The only known disagreement is
 * A,2 v 5 in 8 decks, a composition-dependent cell worth 0.0002 of a bet.
 */
describe('chart audit against the solver', () => {
  const HANDS: Rank[][] = [
    ['3', '2'], ['4', '2'], ['5', '2'], ['5', '3'], ['6', '3'], ['7', '3'], ['7', '4'],
    ['10', '2'], ['10', '3'], ['10', '4'], ['10', '5'], ['10', '6'], ['10', '7'], ['10', '8'],
    ['9', '3'], ['9', '4'], ['9', '5'], ['9', '6'], ['9', '7'],
    ['A', '2'], ['A', '3'], ['A', '4'], ['A', '5'], ['A', '6'], ['A', '7'], ['A', '8'], ['A', '9'],
    ['A', 'A'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6'], ['7', '7'], ['8', '8'], ['9', '9'], ['10', '10'],
  ];
  const rulesets: RuleSet[] = [
    AU_CASINO,
    VEGAS_STRIP,
    VEGAS_DOWNTOWN_H17,
    { ...VEGAS_STRIP, name: 'Vegas Strip ES', surrender: 'early' },
    { ...VEGAS_STRIP, name: 'Vegas Strip no DAS', doubleAfterSplit: false, surrender: 'none' },
  ];

  it.each(rulesets)('$name', (rules) => {
    const diffs: string[] = [];
    for (const hand of HANDS) {
      for (const up of UPCARDS) {
        const available: PlayerMove[] = ['hit', 'stand', 'double'];
        if (hand[0] === hand[1]) available.push('split');
        if (rules.surrender !== 'none') available.push('surrender');
        const chart = basicStrategy({ cards: cards(...hand), dealerUpcard: up, rules, available }).move;
        const solved = evaluateMoves({ cards: cards(...hand), dealerUpcard: up, rules, available });
        if (solved[0]?.move !== chart && evCost(solved, chart) > 0.0005) {
          diffs.push(`${hand.join(',')} v ${up}: chart ${chart}, solver ${solved[0]?.move}`);
        }
      }
    }
    expect(diffs).toEqual([]);
  }, 60_000);
});
