import { describe, expect, it } from 'vitest';
import { createCards } from './cards';
import { COUNTING_SYSTEMS, HI_LO, KO, OMEGA_II, flooredTrueCount, runningCount, tagFor, trueCount } from './counting';

describe('counting systems', () => {
  it('balanced systems sum to zero over a deck; KO to +4', () => {
    const deck = createCards(1);
    expect(runningCount(HI_LO, deck)).toBe(0);
    expect(runningCount(OMEGA_II, deck)).toBe(0);
    expect(runningCount(KO, deck)).toBe(4);
  });

  it('KO starts at 4 - 4 × decks so a full shoe ends at +4', () => {
    for (const decks of [1, 2, 6, 8]) {
      expect(runningCount(KO, createCards(decks), KO.initialRunningCount(decks))).toBe(4);
    }
  });

  it('tags individual cards', () => {
    expect(tagFor(HI_LO, { rank: '5' })).toBe(1);
    expect(tagFor(HI_LO, { rank: 'Q' })).toBe(-1);
    expect(tagFor(OMEGA_II, { rank: '9' })).toBe(-1);
    expect(tagFor(KO, { rank: '7' })).toBe(1);
    expect(COUNTING_SYSTEMS.every((s) => s.initialRunningCount(6) <= 0)).toBe(true);
  });

  it('converts to a true count', () => {
    expect(trueCount(6, 3)).toBe(2);
    expect(trueCount(-5, 2)).toBe(-2.5);
    expect(trueCount(4, 0)).toBe(16); // floored at a quarter deck
    expect(flooredTrueCount(-5, 2)).toBe(-3);
    expect(flooredTrueCount(5, 2)).toBe(2);
  });
});
