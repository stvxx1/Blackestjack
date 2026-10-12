import { describe, expect, it } from 'vitest';
import { handTotal, isPair } from './hand';
import { seedRng } from './rng';
import { AU_CASINO, VEGAS_STRIP } from './rules';
import {
  accuracy,
  cellWeight,
  EMPTY_DRILL_STATS,
  generateDrillHand,
  gradeDrill,
  recordDrill,
  type DrillCategory,
  type DrillHand,
  type DrillStats,
} from './trainer';
import { cards } from './test-utils';

function many(category: DrillCategory, n = 300, stats?: DrillStats): DrillHand[] {
  let rng = seedRng(11);
  const out: DrillHand[] = [];
  for (let i = 0; i < n; i++) {
    const r = generateDrillHand(VEGAS_STRIP, category, rng, stats);
    rng = r.rng;
    out.push(r.hand);
  }
  return out;
}

describe('strategy drill generation', () => {
  it('respects the category', () => {
    expect(many('pairs').every((h) => isPair(h.cards))).toBe(true);
    expect(many('soft').every((h) => handTotal(h.cards).soft && !isPair(h.cards))).toBe(true);
    for (const h of many('hard')) {
      const t = handTotal(h.cards);
      expect(t.soft).toBe(false);
      expect(isPair(h.cards)).toBe(false);
      expect(t.total).toBeGreaterThanOrEqual(5);
      expect(t.total).toBeLessThanOrEqual(19);
    }
  });

  it('labels the chart cell and offers the right moves', () => {
    for (const h of many('all', 200)) {
      const [kind, value, up] = h.cell.split(':');
      expect(['hard', 'soft', 'pair']).toContain(kind);
      expect(Number(value)).toBeGreaterThan(0);
      expect(Number(up)).toBeGreaterThan(0);
      expect(h.available.includes('split')).toBe(kind === 'pair');
      expect(h.available).toContain('surrender');
      expect(new Set([...h.cards, h.upcard].map((c) => c.id)).size).toBe(3);
    }
  });

  it('drifts toward cells you keep missing', () => {
    const weak = 'hard:16:10';
    const stats: DrillStats = { ...EMPTY_DRILL_STATS, cells: { [weak]: { attempts: 10, correct: 0 } } };
    const mastered: DrillStats = { ...EMPTY_DRILL_STATS, cells: { [weak]: { attempts: 10, correct: 10 } } };
    const hitsWeak = many('hard', 3000, stats).filter((h) => h.cell === weak).length;
    const hitsMastered = many('hard', 3000, mastered).filter((h) => h.cell === weak).length;
    expect(hitsWeak).toBeGreaterThan(hitsMastered * 3);
  });

  it('weights cells by miss rate', () => {
    expect(cellWeight(undefined)).toBe(2);
    expect(cellWeight({ attempts: 4, correct: 4 })).toBe(1);
    expect(cellWeight({ attempts: 4, correct: 0 })).toBe(5);
  });
});

describe('grading', () => {
  const hand: DrillHand = { cards: cards('6', '5'), upcard: { id: 99, rank: '10', suit: 'clubs' }, available: ['hit', 'stand', 'double'], cell: 'hard:11:10' };

  it('grades against the rule-specific chart and prices mistakes', () => {
    const peek = gradeDrill(VEGAS_STRIP, hand, 'double');
    expect(peek).toMatchObject({ correct: true, cost: 0 });
    const enhc = gradeDrill(AU_CASINO, hand, 'double');
    expect(enhc.correct).toBe(false);
    expect(enhc.expected.move).toBe('hit');
    expect(enhc.cost).toBeGreaterThan(0);
    expect(gradeDrill(VEGAS_STRIP, hand, 'stand').cost).toBeGreaterThan(0.2);
  });

  it('tracks streaks, accuracy and per-cell stats', () => {
    let s = EMPTY_DRILL_STATS;
    s = recordDrill(s, 'a', { correct: true, cost: 0 });
    s = recordDrill(s, 'a', { correct: true, cost: 0 });
    s = recordDrill(s, 'b', { correct: false, cost: 0.1 });
    s = recordDrill(s, 'a', { correct: true, cost: 0 });
    expect(s).toMatchObject({ attempts: 4, correct: 3, streak: 1, bestStreak: 2, evLost: 0.1 });
    expect(s.cells).toEqual({ a: { attempts: 3, correct: 3 }, b: { attempts: 1, correct: 0 } });
    expect(accuracy(s)).toBe(0.75);
    expect(accuracy(EMPTY_DRILL_STATS)).toBe(0);
  });
});
