import { describe, expect, it } from 'vitest';
import {
  decisionAccuracy,
  emptySessionStats,
  logMistake,
  MISTAKE_LOG_LIMIT,
  observedReturn,
  recordDecision,
  recordRound,
  winRate,
  type Mistake,
} from './session';
import { VEGAS_STRIP } from './rules';
import { play, stackedGame } from './test-utils';
import { visibleCards } from './game';

const PEEK = { ...VEGAS_STRIP, insurance: false };

describe('session stats', () => {
  it('records wins, blackjacks, busts and money', () => {
    let s = emptySessionStats(100_000);
    const win = play(stackedGame(PEEK, ['10', '10', '9', '7']), { type: 'deal', bet: 2_500 }, { type: 'stand' });
    s = recordRound(s, win);
    const bj = play(stackedGame(PEEK, ['A', '9', 'K', '7']), { type: 'deal', bet: 2_500 });
    s = recordRound(s, bj);
    const bust = play(stackedGame(PEEK, ['10', '6', '6', '10', 'K']), { type: 'deal', bet: 2_500 }, { type: 'hit' });
    s = recordRound(s, bust);
    expect(s).toMatchObject({ rounds: 3, hands: 3, wins: 2, losses: 1, blackjacks: 1, busts: 1, wagered: 7_500, net: 3_750 });
    expect(s.biggestWin).toBe(3_750);
    expect(s.biggestLoss).toBe(-2_500);
    expect(winRate(s)).toBeCloseTo(2 / 3);
    expect(observedReturn(s)).toBe(0.5);
  });

  it('records pushes, surrenders, plain losses and insurance stakes', () => {
    const deal = { type: 'deal', bet: 2_500 } as const;
    let s = emptySessionStats(100_000);
    s = recordRound(s, play(stackedGame(PEEK, ['10', '10', '8', '8']), deal, { type: 'stand' }));
    s = recordRound(s, play(stackedGame(PEEK, ['10', '10', '6', '8']), deal, { type: 'surrender' }));
    s = recordRound(s, play(stackedGame(PEEK, ['10', '10', '7', '8']), deal, { type: 'stand' }));
    s = recordRound(s, play(stackedGame(VEGAS_STRIP, ['10', 'A', '9', 'K']), deal, { type: 'insurance', take: true }));
    expect(s).toMatchObject({ rounds: 4, pushes: 1, surrenders: 1, losses: 3, wins: 0 });
    expect(s.wagered).toBe(4 * 2_500 + 1_250);
    expect(s.net).toBe(-1_250 - 2_500 + 0);
    expect(s.lowBankroll).toBeLessThan(100_000);
  });

  it('ignores rounds still in play', () => {
    const s = emptySessionStats(0);
    const live = play(stackedGame(PEEK, ['10', '9', '6', '8']), { type: 'deal', bet: 2_500 });
    expect(recordRound(s, live)).toBe(s);
  });

  it('tracks decision accuracy and EV lost', () => {
    let s = emptySessionStats(0);
    expect(decisionAccuracy(s)).toBe(1);
    s = recordDecision(s, false, 0);
    s = recordDecision(s, true, 125);
    expect(s).toMatchObject({ decisions: 2, mistakes: 1, evLost: 125 });
    expect(decisionAccuracy(s)).toBe(0.5);
    expect(winRate(emptySessionStats(0))).toBe(0);
    expect(observedReturn(emptySessionStats(0))).toBe(0);
  });

  it('caps the mistake log, newest first', () => {
    const m = (round: number): Mistake => ({
      round, at: 0, hand: ['10', '6'], upcard: '10', chose: 'stand', correct: 'hit', deviation: null, trueCount: null, evLost: 1,
    });
    let log: Mistake[] = [];
    for (let i = 0; i < MISTAKE_LOG_LIMIT + 5; i++) log = logMistake(log, m(i));
    expect(log).toHaveLength(MISTAKE_LOG_LIMIT);
    expect(log[0]?.round).toBe(MISTAKE_LOG_LIMIT + 4);
  });
});

describe('visibleCards', () => {
  it('hides the hole card in a peek game until the round ends', () => {
    const s = play(stackedGame(PEEK, ['10', '9', '7', '8', '2']), { type: 'deal', bet: 2_500 });
    expect(visibleCards(s).map((c) => c.rank)).toEqual(['10', '9', '7']);
    const done = play(s, { type: 'stand' });
    expect(visibleCards(done).map((c) => c.rank)).toEqual(['10', '9', '7', '8']);
  });
});
