import { describe, expect, it } from 'vitest';
import { HI_LO, KO, runningCount, tagFor } from './counting';
import {
  createCountdownDrill,
  createDeviationDrill,
  createRunningCountDrill,
  createTrueCountDrill,
  gradeCountingDrill,
} from './countingDrills';
import { ILLUSTRIOUS_18 } from './deviations';
import { seedRng, type RngState } from './rng';
import { AU_CASINO, VEGAS_STRIP } from './rules';

describe('counting drills', () => {
  it('running count drill deals the requested cards and the right answer', () => {
    const { drill } = createRunningCountDrill(HI_LO, seedRng(1), { cards: 20 });
    expect(drill.cards).toHaveLength(20);
    expect(drill.answer).toBe(runningCount(HI_LO, drill.cards));
    expect(gradeCountingDrill(drill, drill.answer)).toBe(true);
    expect(gradeCountingDrill(drill, drill.answer + 1)).toBe(false);
    expect(createRunningCountDrill(HI_LO, seedRng(1), { cards: 120 }).drill.cards).toHaveLength(120);
  });

  it('true count drill floors running ÷ decks remaining', () => {
    let rng: RngState = seedRng(2);
    for (let i = 0; i < 200; i++) {
      const r = createTrueCountDrill(rng, 6);
      rng = r.rng;
      const d = r.drill;
      expect(d.decksRemaining * 2).toBe(Math.round(d.decksRemaining * 2));
      expect(d.decksRemaining).toBeGreaterThanOrEqual(0.5);
      expect(d.decksRemaining).toBeLessThanOrEqual(6);
      expect(d.answer).toBe(Math.floor(d.runningCount / d.decksRemaining));
    }
  });

  it('countdown: the final count gives away the missing card', () => {
    for (let seed = 0; seed < 50; seed++) {
      const { drill } = createCountdownDrill(HI_LO, seedRng(seed));
      expect(drill.cards).toHaveLength(51);
      const missing = drill.removed[0];
      expect(missing).toBeDefined();
      if (missing) expect(drill.answer + tagFor(HI_LO, missing)).toBe(0);
    }
    const ko = createCountdownDrill(KO, seedRng(3), 0).drill;
    expect(ko.answer).toBe(4);
  });

  it('deviation drills straddle the index', () => {
    let rng: RngState = seedRng(4);
    let above = 0;
    let below = 0;
    for (let i = 0; i < 300; i++) {
      const r = createDeviationDrill(HI_LO, VEGAS_STRIP, rng);
      rng = r.rng;
      const d = r.drill;
      expect(Math.abs(d.trueCount - d.play.index)).toBeLessThanOrEqual(3);
      if (d.trueCount >= d.play.index) above++;
      else below++;
      if (d.play.kind === 'insurance') expect(d.answer).toBe(d.trueCount >= 3 ? 'insure' : 'decline');
      else expect(d.available).toContain(d.answer);
    }
    expect(above).toBeGreaterThan(50);
    expect(below).toBeGreaterThan(50);
  });

  it('builds hands that actually match the index play', () => {
    let rng: RngState = seedRng(5);
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const r = createDeviationDrill(HI_LO, AU_CASINO, rng);
      rng = r.rng;
      seen.add(r.drill.play.id);
    }
    expect(seen.size).toBeGreaterThan(ILLUSTRIOUS_18.length - 5);
    expect(seen.has('11vA')).toBe(false);
  });
});
