import { describe, expect, it } from 'vitest';
import type { CardValue, Rank } from './cards';
import { HI_LO, KO } from './counting';
import { FAB_4, ILLUSTRIOUS_18, indexPlaysFor, recommendPlay, shouldInsure } from './deviations';
import type { PlayerMove } from './game';
import { AU_CASINO, VEGAS_STRIP, type RuleSet } from './rules';
import { cards } from './test-utils';

const NO_SURRENDER: RuleSet = { ...VEGAS_STRIP, surrender: 'none' };
const ALL: PlayerMove[] = ['hit', 'stand', 'double', 'split', 'surrender'];

const rec = (rules: RuleSet, hand: Rank[], up: CardValue, tc?: number, available: PlayerMove[] = ALL) =>
  recommendPlay({ cards: cards(...hand), dealerUpcard: up, rules, available, ...(tc === undefined ? {} : { trueCount: tc }) });

describe('index plays', () => {
  it('has the full Illustrious 18 and Fab 4', () => {
    expect(ILLUSTRIOUS_18).toHaveLength(18);
    expect(FAB_4).toHaveLength(4);
    expect(new Set([...ILLUSTRIOUS_18, ...FAB_4].map((p) => p.id)).size).toBe(22);
    expect(ILLUSTRIOUS_18.find((p) => p.id === 'TTv5')?.label).toBe('T,T v 5');
  });

  it('is pure basic strategy without a true count', () => {
    const r = rec(NO_SURRENDER, ['10', '6'], 10);
    expect(r).toMatchObject({ move: 'hit', deviation: null });
  });

  it.each([
    [['10', '6'], 10, 0, 'stand'],
    [['10', '6'], 10, -1, 'hit'],
    [['10', '5'], 10, 4, 'stand'],
    [['10', '5'], 10, 3, 'hit'],
    [['10', '2'], 3, 2, 'stand'],
    [['10', '2'], 2, 3, 'stand'],
    [['10', '2'], 4, -1, 'hit'],
    [['10', '3'], 2, -2, 'hit'],
    [['6', '4'], 10, 4, 'double'],
    [['6', '3'], 7, 3, 'double'],
    [['6', '5'], 1, 1, 'double'],
    [['6', '5'], 1, 0, 'hit'],
    [['10', 'K'], 6, 4, 'split'],
    [['10', 'K'], 5, 4, 'stand'],
    [['10', 'K'], 5, 5, 'split'],
  ] as const)('%j v %i at TC %i -> %s', (hand, up, tc, move) => {
    expect(rec(NO_SURRENDER, [...hand], up, tc).move).toBe(move);
  });

  it('reports which index play fired', () => {
    expect(rec(NO_SURRENDER, ['10', '6'], 10, 1).deviation?.id).toBe('16v10');
    expect(rec(NO_SURRENDER, ['10', '6'], 10, -3).deviation).toBeNull();
  });

  it('only doubles when doubling is on the table', () => {
    expect(rec(NO_SURRENDER, ['4', '3', '3'], 10, 6, ['hit', 'stand']).move).toBe('hit');
  });

  it('keeps pair plays away from hard-total indices', () => {
    // 6,6 v 4 splits; it is not the "12 v 4" stand/hit index.
    expect(rec(NO_SURRENDER, ['6', '6'], 4, -5).move).toBe('split');
  });

  describe('Fab 4 surrenders', () => {
    it.each([
      [['10', '4'], 10, 3, 'surrender'],
      [['10', '4'], 10, 2, 'hit'],
      [['10', '5'], 10, 0, 'surrender'],
      [['10', '5'], 10, -1, 'hit'],
      [['10', '5'], 9, 2, 'surrender'],
      [['10', '5'], 1, 1, 'surrender'],
      [['10', '5'], 1, 0, 'hit'],
    ] as const)('%j v %i at TC %i -> %s', (hand, up, tc, move) => {
      expect(rec(VEGAS_STRIP, [...hand], up, tc).move).toBe(move);
    });

    it('leaves 16 v 10 surrendering at any count', () => {
      expect(rec(VEGAS_STRIP, ['10', '6'], 10, 3).move).toBe('surrender');
      expect(rec(VEGAS_STRIP, ['10', '6'], 10, -3).move).toBe('surrender');
    });

    it('are only included when surrender is offered', () => {
      expect(indexPlaysFor(NO_SURRENDER).some((p) => p.atOrAbove === 'surrender')).toBe(false);
      expect(indexPlaysFor(VEGAS_STRIP).filter((p) => p.atOrAbove === 'surrender')).toHaveLength(4);
    });
  });

  it('drops doubles and splits into 10/A for no-hole-card games', () => {
    const ids = indexPlaysFor(AU_CASINO).map((p) => p.id);
    expect(ids).not.toContain('10v10');
    expect(ids).not.toContain('11vA');
    expect(ids).not.toContain('10vA');
    expect(ids).toContain('16v10');
    expect(rec(AU_CASINO, ['6', '5'], 1, 10).move).toBe('hit');
  });

  it('insures at Hi-Lo +3 only', () => {
    expect(shouldInsure(HI_LO, 3)).toBe(true);
    expect(shouldInsure(HI_LO, 2)).toBe(false);
    expect(shouldInsure(HI_LO, undefined)).toBe(false);
    expect(shouldInsure(KO, 10)).toBe(false);
  });
});
