import { describe, expect, it } from 'vitest';
import { handTotal, isPair } from '@/engine';
import { memoryStorage } from '@/services/storage';
import { createCountingStore } from './countingStore';
import { createTrainerStore } from './trainerStore';

describe('strategy trainer store', () => {
  it('grades answers, deals the next hand and keeps stats', () => {
    const store = createTrainerStore({ storage: memoryStorage(), seed: 3 });
    const first = store.getState().current;
    const move = first.available[0];
    if (!move) throw new Error('no moves');
    store.getState().answer(move);
    const s = store.getState();
    expect(s.last?.hand).toBe(first);
    expect(s.stats.attempts).toBe(1);
    expect(s.current).not.toBe(first);
  });

  it('ignores moves the hand does not offer', () => {
    const store = createTrainerStore({ storage: memoryStorage(), seed: 3 });
    store.getState().setCategory('soft');
    store.getState().answer('split');
    expect(store.getState().stats.attempts).toBe(0);
  });

  it('switches category and table immediately', () => {
    const store = createTrainerStore({ storage: memoryStorage(), seed: 4 });
    store.getState().setCategory('pairs');
    expect(isPair(store.getState().current.cards)).toBe(true);
    store.getState().setCategory('soft');
    expect(handTotal(store.getState().current.cards).soft).toBe(true);
    store.getState().setPreset('vegas-strip');
    expect(store.getState().current.available).toContain('surrender');
  });

  it('persists settings and stats, then deals a matching hand on reload', () => {
    const storage = memoryStorage();
    const a = createTrainerStore({ storage, seed: 5 });
    a.getState().setCategory('pairs');
    const m = a.getState().current.available[0];
    if (m) a.getState().answer(m);
    const b = createTrainerStore({ storage, seed: 6 }).getState();
    expect(b.category).toBe('pairs');
    expect(b.stats.attempts).toBe(1);
    expect(isPair(b.current.cards)).toBe(true);
    a.getState().resetStats();
    expect(a.getState().stats.attempts).toBe(0);
  });
});

describe('counting trainer store', () => {
  it('runs a running-count drill end to end', () => {
    const store = createCountingStore({ storage: memoryStorage(), seed: 7 });
    store.getState().setRunLength(30);
    store.getState().start('running');
    const drill = store.getState().drill;
    if (drill?.kind !== 'running') throw new Error('expected running drill');
    expect(drill.cards).toHaveLength(30);
    store.getState().submit(drill.answer, 4_321.4);
    const s = store.getState();
    expect(s.drill).toBeNull();
    expect(s.lastOutcome).toEqual({ correct: true, expected: drill.answer, given: drill.answer, elapsedMs: 4_321 });
    expect(s.stats.running).toEqual({ attempts: 1, correct: 1, bestMs: 4_321, totalMs: 4_321 });
  });

  it('only records best times for correct answers', () => {
    const store = createCountingStore({ storage: memoryStorage(), seed: 8 });
    store.getState().start('trueCount');
    const d = store.getState().drill;
    if (d?.kind !== 'trueCount') throw new Error('expected true count drill');
    store.getState().submit(d.answer + 1, 100);
    expect(store.getState().stats.trueCount).toMatchObject({ attempts: 1, correct: 0, bestMs: null });
    store.getState().submit(0, 10); // no active drill: ignored
    expect(store.getState().stats.trueCount.attempts).toBe(1);
  });

  it('generates every drill kind', () => {
    const store = createCountingStore({ storage: memoryStorage(), seed: 9 });
    for (const kind of ['running', 'trueCount', 'countdown', 'deviation'] as const) {
      store.getState().start(kind);
      expect(store.getState().drill?.kind).toBe(kind);
    }
  });

  it('persists system, table, length and stats', () => {
    const storage = memoryStorage();
    const a = createCountingStore({ storage, seed: 10 });
    a.getState().setSystem('omega-ii');
    a.getState().setPreset('atlantic-city');
    a.getState().setRunLength(1_000);
    a.getState().start('countdown');
    a.getState().submit(0, 1);
    const b = createCountingStore({ storage, seed: 11 }).getState();
    expect(b.system).toBe('omega-ii');
    expect(b.presetId).toBe('atlantic-city');
    expect(b.runLength).toBe(312);
    expect(b.stats.countdown.attempts).toBe(1);
    a.getState().resetStats();
    expect(a.getState().stats.countdown.attempts).toBe(0);
  });
});
