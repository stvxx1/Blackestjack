import { describe, expect, it } from 'vitest';
import { nextInt, nextUint32, randomSeed, seedRng, shuffle } from './rng';

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = nextUint32(seedRng(42));
    const b = nextUint32(seedRng(42));
    expect(a).toEqual(b);
    expect(nextUint32(seedRng(43)).value).not.toBe(a.value);
  });

  it('never yields an all-zero state', () => {
    for (let seed = 0; seed < 100; seed++) expect(seedRng(seed).some((v) => v !== 0)).toBe(true);
  });

  it('produces uint32 values', () => {
    let s = seedRng(7);
    for (let i = 0; i < 1000; i++) {
      const r = nextUint32(s);
      s = r.state;
      expect(Number.isInteger(r.value)).toBe(true);
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThan(2 ** 32);
    }
  });

  it('nextInt is uniform enough (chi-squared, 6 bins)', () => {
    const bins = new Array<number>(6).fill(0);
    let s = seedRng(123);
    const n = 60_000;
    for (let i = 0; i < n; i++) {
      const r = nextInt(s, 6);
      s = r.state;
      bins[r.value] = (bins[r.value] ?? 0) + 1;
    }
    const expected = n / 6;
    const chi2 = bins.reduce((sum, o) => sum + (o - expected) ** 2 / expected, 0);
    // 5 degrees of freedom, p = 0.001 critical value.
    expect(chi2).toBeLessThan(20.52);
  });

  it('nextInt rejects bad bounds', () => {
    expect(() => nextInt(seedRng(1), 0)).toThrow(RangeError);
    expect(() => nextInt(seedRng(1), 1.5)).toThrow(RangeError);
    expect(() => nextInt(seedRng(1), 2 ** 33)).toThrow(RangeError);
  });

  it('shuffle is a permutation and leaves its input alone', () => {
    const input = Array.from({ length: 52 }, (_, i) => i);
    const { items } = shuffle(input, seedRng(9));
    expect(items).not.toEqual(input);
    expect([...items].sort((a, b) => a - b)).toEqual(input);
    expect(input[0]).toBe(0);
  });

  it('randomSeed comes from the CSPRNG', () => {
    const seeds = new Set(Array.from({ length: 20 }, randomSeed));
    expect(seeds.size).toBeGreaterThan(15);
  });
});
