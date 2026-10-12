import { describe, expect, it } from 'vitest';
import { GameError } from './errors';
import {
  applyAction,
  createGame,
  legalMoves,
  type GameAction,
  type GameState,
} from './game';
import { handTotal } from './hand';
import { nextInt, seedRng } from './rng';
import { AU_CASINO, VEGAS_STRIP, type RuleSet } from './rules';
import { cards, play, stackedGame } from './test-utils';

const BET = 2_500;
const deal: GameAction = { type: 'deal', bet: BET };
const hit: GameAction = { type: 'hit' };
const stand: GameAction = { type: 'stand' };
const double: GameAction = { type: 'double' };
const split: GameAction = { type: 'split' };
const surrender: GameAction = { type: 'surrender' };
const insure = (take: boolean): GameAction => ({ type: 'insurance', take });

/** Peek game, no insurance, so tests only see the decisions they're about. */
const PEEK: RuleSet = { ...VEGAS_STRIP, insurance: false };
const ENHC: RuleSet = { ...AU_CASINO, insurance: false };

const ranksOf = (s: GameState, hand = 0): string[] => (s.hands[hand]?.cards ?? []).map((c) => c.rank);

describe('dealing', () => {
  it('deals player, dealer, player, hole card in a peek game', () => {
    const s = play(stackedGame(PEEK, ['10', '9', '7', '8']), deal);
    expect(ranksOf(s)).toEqual(['10', '7']);
    expect(s.dealer.map((c) => c.rank)).toEqual(['9', '8']);
    expect(s.phase).toBe('playerTurn');
    expect(s.bankroll).toBe(100_000 - BET);
    expect(s.round).toBe(1);
  });

  it('gives the dealer one card in a no-hole-card game', () => {
    const s = play(stackedGame(ENHC, ['10', '9', '7', '8']), deal);
    expect(s.dealer.map((c) => c.rank)).toEqual(['9']);
  });

  it('validates bets', () => {
    const s = stackedGame(PEEK, ['10', '9', '7', '8'], 3_000);
    const code = (bet: number): unknown => {
      try {
        applyAction(s, { type: 'deal', bet });
      } catch (e) {
        return e instanceof GameError ? e.code : e;
      }
      return null;
    };
    expect(code(100)).toBe('INVALID_BET');
    expect(code(2_500.5)).toBe('INVALID_BET');
    expect(code(PEEK.maxBet + 1)).toBe('INVALID_BET');
    expect(code(5_000)).toBe('INSUFFICIENT_FUNDS');
  });

  it('rejects out-of-phase actions', () => {
    const s = stackedGame(PEEK, ['10', '9', '7', '8']);
    expect(() => applyAction(s, hit)).toThrow(GameError);
    expect(() => applyAction(s, insure(true))).toThrow(/insurance/);
    const dealt = applyAction(s, deal);
    expect(() => applyAction(dealt, deal)).toThrow(/cannot deal/);
  });

  it('never mutates the previous state', () => {
    const s = play(stackedGame(PEEK, ['10', '9', '6', '8', '5']), deal);
    const snapshot = JSON.stringify(s);
    applyAction(s, hit);
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it('rejects invalid starting bankrolls and rules', () => {
    expect(() => createGame(PEEK, { bankroll: -1 })).toThrow(GameError);
    expect(() => createGame({ ...PEEK, decks: 9 }, { bankroll: 0 })).toThrow(/decks/);
    expect(() => createGame({ ...ENHC, surrender: 'early' }, { bankroll: 0 })).toThrow(/early surrender/);
  });
});

describe('settlement', () => {
  it('pays even money on a win', () => {
    const s = play(stackedGame(PEEK, ['10', '10', '9', '7']), deal, stand);
    expect(s.phase).toBe('roundOver');
    expect(s.result?.hands[0]).toMatchObject({ outcome: 'win', wagered: BET, returned: 5_000, net: 2_500 });
    expect(s.bankroll).toBe(102_500);
  });

  it('pushes equal totals and loses lower ones', () => {
    expect(play(stackedGame(PEEK, ['10', '10', '8', '8']), deal, stand).result?.hands[0]?.outcome).toBe('push');
    expect(play(stackedGame(PEEK, ['10', '10', '7', '8']), deal, stand).result?.hands[0]?.outcome).toBe('lose');
  });

  it('pays a natural 3:2 without the dealer drawing', () => {
    const s = play(stackedGame(PEEK, ['A', '9', 'K', '7']), deal);
    expect(s.phase).toBe('roundOver');
    expect(s.result?.hands[0]).toMatchObject({ outcome: 'blackjack', returned: 6_250, net: 3_750 });
    expect(s.dealer).toHaveLength(2);
  });

  it('pays 6:5 tables at 6:5', () => {
    const s = play(stackedGame({ ...PEEK, blackjackPays: [6, 5] }, ['A', '9', 'K', '7']), deal);
    expect(s.result?.hands[0]?.net).toBe(3_000);
  });

  it('busts the player before the dealer plays', () => {
    const s = play(stackedGame(PEEK, ['10', '6', '6', '10', 'K']), deal, hit);
    expect(s.result?.hands[0]?.outcome).toBe('bust');
    expect(s.dealer).toHaveLength(2);
  });

  it('auto-stands on 21', () => {
    const s = play(stackedGame(PEEK, ['5', '10', '6', '8', 'K']), deal, hit);
    expect(s.phase).toBe('roundOver');
    expect(s.result?.hands[0]?.outcome).toBe('win');
  });

  it('pays every hand when the dealer busts', () => {
    const s = play(stackedGame(PEEK, ['10', '6', '2', '10', '10']), deal, stand);
    expect(s.result?.dealerBust).toBe(true);
    expect(s.result?.hands[0]?.outcome).toBe('win');
  });
});

describe('dealer play', () => {
  it('stands on soft 17 under S17', () => {
    const s = play(stackedGame(PEEK, ['10', 'A', '8', '6']), deal, stand);
    expect(s.dealer).toHaveLength(2);
    expect(s.result?.hands[0]?.outcome).toBe('win');
  });

  it('hits soft 17 under H17', () => {
    const s = play(stackedGame({ ...PEEK, dealerHitsSoft17: true }, ['10', 'A', '8', '6', '3']), deal, stand);
    expect(s.dealer.map((c) => c.rank)).toEqual(['A', '6', '3']);
    expect(s.result?.dealerTotal).toBe(20);
    expect(s.result?.hands[0]?.outcome).toBe('lose');
  });
});

describe('peek and insurance', () => {
  it('ends the round at once when the dealer peeks a natural', () => {
    const s = play(stackedGame(PEEK, ['10', '10', '9', 'A']), deal);
    expect(s.phase).toBe('roundOver');
    expect(s.result?.dealerBlackjack).toBe(true);
    expect(s.result?.hands[0]?.outcome).toBe('lose');
  });

  it('offers insurance under an ace and pays 2:1', () => {
    let s = play(stackedGame(VEGAS_STRIP, ['10', 'A', '9', 'K']), deal);
    expect(s.phase).toBe('insurance');
    s = applyAction(s, insure(true));
    expect(s.result?.insurance).toMatchObject({ outcome: 'win', wagered: 1_250, returned: 3_750 });
    expect(s.result?.net).toBe(0);
    expect(s.bankroll).toBe(100_000);
  });

  it('loses insurance when the dealer has no natural, then plays on', () => {
    let s = play(stackedGame(VEGAS_STRIP, ['10', 'A', '9', '6', '5']), deal, insure(true));
    expect(s.phase).toBe('playerTurn');
    expect(s.bankroll).toBe(100_000 - BET - 1_250);
    s = applyAction(s, stand);
    // Dealer A,6 is soft 17 and stands; 19 wins.
    expect(s.result?.insurance?.net).toBe(-1_250);
    expect(s.result?.net).toBe(1_250);
  });

  it('even money: insured natural vs dealer natural nets the bet', () => {
    const s = play(stackedGame(VEGAS_STRIP, ['A', 'A', 'K', 'K']), deal, insure(true));
    expect(s.result?.hands[0]?.outcome).toBe('push');
    expect(s.result?.net).toBe(BET);
  });

  it('does not charge declined insurance', () => {
    const s = play(stackedGame(VEGAS_STRIP, ['10', 'A', '9', '6']), deal, insure(false));
    expect(s.insuranceBet).toBe(0);
    expect(s.bankroll).toBe(100_000 - BET);
  });
});

describe('no hole card (Australian rules)', () => {
  it('takes doubles too when the dealer makes a natural', () => {
    // P 6,5 vs 10; double draws 9 for 20; hole card A.
    const s = play(stackedGame(ENHC, ['6', '10', '5', '9', 'A']), deal, double);
    expect(s.result?.dealerBlackjack).toBe(true);
    expect(s.result?.hands[0]).toMatchObject({ outcome: 'lose', wagered: 5_000, returned: 0 });
    expect(s.bankroll).toBe(95_000);
  });

  it('takes split hands too', () => {
    const s = play(stackedGame(ENHC, ['8', 'A', '8', '10', '9', 'K']), deal, split, stand, stand);
    expect(s.result?.hands.map((h) => h.outcome)).toEqual(['lose', 'lose']);
    expect(s.result?.net).toBe(-5_000);
  });

  it('only loses the original bet under OBO', () => {
    const obo: RuleSet = { ...ENHC, holeCard: 'enhc-obo' };
    const s = play(stackedGame(obo, ['6', '10', '5', '9', 'A']), deal, double);
    expect(s.result?.net).toBe(-BET);
    const splitRound = play(stackedGame(obo, ['8', 'A', '8', '10', '9', 'K']), deal, split, stand, stand);
    expect(splitRound.result?.net).toBe(-BET);
  });

  it('draws the hole card to settle a player natural', () => {
    const s = play(stackedGame(ENHC, ['A', '10', 'K', '7']), deal);
    expect(s.dealer.map((c) => c.rank)).toEqual(['10', '7']);
    expect(s.result?.hands[0]?.outcome).toBe('blackjack');
  });

  it('pushes a player natural against a dealer natural', () => {
    const s = play(stackedGame(ENHC, ['A', '10', 'K', 'A']), deal);
    expect(s.result?.hands[0]?.outcome).toBe('push');
  });

  it('skips the hole card when every hand is already bust', () => {
    const s = play(stackedGame(ENHC, ['10', '9', '6', 'K']), deal, hit);
    expect(s.dealer).toHaveLength(1);
  });
});

describe('doubling', () => {
  it('doubles the bet and deals exactly one card', () => {
    const s = play(stackedGame(PEEK, ['6', '9', '5', '8', '2']), deal, double);
    expect(ranksOf(s)).toEqual(['6', '5', '2']);
    expect(s.dealer).toHaveLength(2);
    expect(s.result?.hands[0]).toMatchObject({ outcome: 'lose', wagered: 5_000 });
  });

  it('respects 9-11 and 10-11 restrictions', () => {
    const at = (rules: RuleSet, p: ['A' | '5' | '6', '7' | '3' | '4']): boolean =>
      legalMoves(play(stackedGame(rules, [p[0], '9', p[1], '8']), deal)).includes('double');
    const nineEleven = { ...PEEK, doubleOn: '9-11' as const };
    const tenEleven = { ...PEEK, doubleOn: '10-11' as const };
    expect(at(nineEleven, ['6', '3'])).toBe(true); // 9
    expect(at(tenEleven, ['6', '3'])).toBe(false);
    expect(at(tenEleven, ['6', '4'])).toBe(true); // 10
    expect(at(nineEleven, ['A', '7'])).toBe(false); // soft 18
    expect(at(PEEK, ['A', '7'])).toBe(true);
  });

  it('needs the bankroll to cover it', () => {
    const s = play(stackedGame(PEEK, ['6', '9', '5', '7'], 4_000), deal);
    expect(legalMoves(s)).not.toContain('double');
    expect(legalMoves(s)).not.toContain('split');
    expect(() => applyAction(s, double)).toThrow(/not available/);
  });

  it('is only allowed on two cards', () => {
    const s = play(stackedGame(PEEK, ['2', '9', '3', '7', '2']), deal, hit);
    expect(legalMoves(s)).toEqual(['hit', 'stand']);
  });
});

describe('splitting', () => {
  it('plays split hands left to right, dealing second cards on arrival', () => {
    // P 8,8 vs 6 (hole 10). Hand 1 draws 3 -> 11, doubles onto a 10. Hand 2 draws 10, stands. Dealer draws 10, busts.
    let s = play(stackedGame(PEEK, ['8', '6', '8', '10', '3', '10', '10', '10']), deal, split);
    expect(s.hands).toHaveLength(2);
    expect(ranksOf(s, 0)).toEqual(['8', '3']);
    expect(ranksOf(s, 1)).toEqual(['8']);
    expect(s.activeHand).toBe(0);
    s = applyAction(s, double);
    expect(s.activeHand).toBe(1);
    expect(ranksOf(s, 1)).toEqual(['8', '10']);
    s = applyAction(s, stand);
    expect(s.result?.hands.map((h) => h.net)).toEqual([5_000, 2_500]);
    expect(s.bankroll).toBe(107_500);
  });

  it('pays 21 on a split hand 1:1, not as blackjack', () => {
    const s = play(stackedGame(PEEK, ['A', '9', 'A', '7', 'K', 'Q', '2']), deal, split);
    expect(s.phase).toBe('roundOver');
    expect(s.result?.hands).toEqual([
      { outcome: 'win', wagered: BET, returned: 5_000, net: 2_500 },
      { outcome: 'win', wagered: BET, returned: 5_000, net: 2_500 },
    ]);
  });

  it('gives split aces one card each', () => {
    const s = play(stackedGame(PEEK, ['A', '9', 'A', '7', '5', '6', '2']), deal, split);
    expect(s.phase).toBe('roundOver');
    expect(s.hands.map((h) => h.cards.length)).toEqual([2, 2]);
  });

  it('allows resplitting aces only where the rules do', () => {
    const ranks = ['A', '9', 'A', '7', 'A', '5', '6', '2', '3'] as const;
    const withRsa = play(stackedGame(VEGAS_STRIP, [...ranks]), deal, split);
    expect(withRsa.phase).toBe('playerTurn');
    expect(legalMoves(withRsa)).toEqual(['stand', 'split']);

    const noRsa = play(stackedGame({ ...PEEK, resplitAces: false }, [...ranks]), deal, split);
    expect(noRsa.phase).toBe('roundOver');
    expect(noRsa.hands).toHaveLength(2);
  });

  it('lets you hit split aces when the rules allow it', () => {
    const s = play(stackedGame({ ...PEEK, hitSplitAces: true }, ['A', '9', 'A', '7', '5']), deal, split);
    expect(legalMoves(s)).toContain('hit');
  });

  it('caps the number of hands', () => {
    let s = play(stackedGame(PEEK, ['8', '9', '8', '7', '8', '8', '8', '8', '8']), deal);
    s = play(s, split, split, split);
    expect(s.hands).toHaveLength(4);
    expect(legalMoves(s)).not.toContain('split');
    expect(() => applyAction(s, split)).toThrow(GameError);
  });

  it('blocks doubling after a split without DAS', () => {
    const s = play(stackedGame({ ...PEEK, doubleAfterSplit: false }, ['8', '6', '8', '10', '3']), deal, split);
    expect(legalMoves(s)).not.toContain('double');
  });

  it('splits unlike tens', () => {
    const s = play(stackedGame(PEEK, ['K', '6', 'J', '10', '5', '5']), deal);
    expect(legalMoves(s)).toContain('split');
  });
});

describe('surrender', () => {
  it('returns half the bet under late surrender', () => {
    const s = play(stackedGame(PEEK, ['10', '10', '6', '8']), deal, surrender);
    expect(s.result?.hands[0]).toMatchObject({ outcome: 'surrender', returned: 1_250, net: -1_250 });
  });

  it('is unavailable after hitting, after splitting, or when not offered', () => {
    expect(legalMoves(play(stackedGame(PEEK, ['2', '10', '3', '8', '2']), deal, hit))).not.toContain('surrender');
    expect(legalMoves(play(stackedGame(PEEK, ['8', '10', '8', '7', '2']), deal, split))).not.toContain('surrender');
    expect(legalMoves(play(stackedGame(ENHC, ['10', '10', '6']), deal))).not.toContain('surrender');
    expect(() => play(stackedGame(ENHC, ['10', '10', '6']), deal, surrender)).toThrow(GameError);
  });

  describe('early surrender', () => {
    const ES: RuleSet = { ...PEEK, surrender: 'early' };

    it('beats a dealer natural', () => {
      const s = play(stackedGame(ES, ['10', '10', '6', 'A']), deal);
      expect(s.phase).toBe('playerTurn');
      expect(s.peekPending).toBe(true);
      const done = applyAction(s, surrender);
      expect(done.result?.hands[0]?.net).toBe(-1_250);
    });

    it('peeks as soon as the player plays on', () => {
      const s = play(stackedGame(ES, ['10', '10', '6', 'A', '5']), deal, hit);
      expect(s.result?.dealerBlackjack).toBe(true);
      expect(ranksOf(s)).toEqual(['10', '6']);
      expect(s.result?.hands[0]?.outcome).toBe('lose');
    });

    it('continues normally when the dealer has no natural', () => {
      const s = play(stackedGame(ES, ['10', '10', '6', '7', '2']), deal, hit);
      expect(s.peekPending).toBe(false);
      expect(ranksOf(s)).toEqual(['10', '6', '2']);
    });
  });
});

describe('shoe lifecycle', () => {
  it('reshuffles before the deal once the cut card is out', () => {
    const g = createGame(AU_CASINO, { bankroll: 100_000, seed: 3 });
    const pastCut = { ...g, shoe: { ...g.shoe, position: g.shoe.cutCardIndex } };
    const s = applyAction(pastCut, deal);
    expect(s.reshuffled).toBe(true);
    expect(s.shoe.position).toBe(AU_CASINO.burnCards + 3);
    expect(applyAction(g, deal).reshuffled).toBe(false);
  });

  it('reshuffles the discards if a round runs the shoe dry', () => {
    const s = play(stackedGame(PEEK, ['2', '9', '3', '7']), deal, hit);
    const ids = [...s.dealer, ...s.hands.flatMap((h) => h.cards)].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(s.hands[0]?.cards).toHaveLength(3);
    // The emergency shoe has no cut card left, so the next round starts fresh.
    expect(s.shoe.cutCardIndex).toBe(0);
  });
});

describe('property: random play over thousands of rounds', () => {
  for (const rules of [AU_CASINO, VEGAS_STRIP, { ...VEGAS_STRIP, surrender: 'early' as const, dealerHitsSoft17: true }]) {
    it(`conserves money and never breaks (${rules.name})`, () => {
      let rng = seedRng(2026);
      const pick = <T,>(xs: readonly T[]): T => {
        const r = nextInt(rng, xs.length);
        rng = r.state;
        return xs[r.value] as T;
      };
      let s = createGame(rules, { bankroll: 10_000_000, seed: 77 });
      for (let round = 0; round < 3_000; round++) {
        const before = s.bankroll;
        s = applyAction(s, { type: 'deal', bet: pick([2_500, 5_000, 10_000]) });
        while (s.phase !== 'roundOver') {
          s = s.phase === 'insurance' ? applyAction(s, insure(pick([true, false]))) : applyAction(s, { type: pick(legalMoves(s)) });
        }
        expect(s.bankroll - before).toBe(s.result?.net);
        const ids = [...s.dealer, ...s.hands.flatMap((h) => h.cards)].map((c) => c.id);
        expect(new Set(ids).size).toBe(ids.length);
        const dealer = handTotal(s.dealer);
        const anyLive = s.hands.some((h) => h.status === 'stood');
        if (anyLive && !s.result?.dealerBlackjack) expect(dealer.total).toBeGreaterThanOrEqual(17);
        expect(s.hands.length).toBeLessThanOrEqual(rules.maxHands);
      }
    });
  }
});

describe('helpers', () => {
  it('cards() makes unique ids', () => {
    expect(new Set(cards('A', 'A', 'A').map((c) => c.id)).size).toBe(3);
  });
});
