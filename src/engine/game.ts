import { cardValue, createCards, type Card } from './cards';
import { GameError } from './errors';
import { handTotal, isBust, isNatural, isPair } from './hand';
import { randomSeed, seedRng, shuffle, type RngState } from './rng';
import { validateRules, type RuleSet } from './rules';
import { createShoe, dealtCards, drawFrom, isPastCutCard, type Shoe } from './shoe';

export type Phase = 'betting' | 'insurance' | 'playerTurn' | 'roundOver';
export type HandStatus = 'active' | 'stood' | 'bust' | 'surrendered' | 'blackjack';
export type PlayerMove = 'hit' | 'stand' | 'double' | 'split' | 'surrender';

export interface PlayerHand {
  readonly cards: readonly Card[];
  /** Original wager on this hand, in cents. */
  readonly baseBet: number;
  /** Everything riding on this hand: `baseBet`, doubled if the hand was doubled. */
  readonly bet: number;
  readonly doubled: boolean;
  readonly fromSplit: boolean;
  readonly splitAces: boolean;
  readonly status: HandStatus;
}

export type Outcome = 'blackjack' | 'win' | 'push' | 'lose' | 'bust' | 'surrender';

export interface HandResult {
  readonly outcome: Outcome;
  readonly wagered: number;
  /** Cents handed back to the player: stake plus winnings, or zero. */
  readonly returned: number;
  readonly net: number;
}

export interface RoundResult {
  readonly hands: readonly HandResult[];
  readonly insurance: HandResult | null;
  readonly dealerTotal: number;
  readonly dealerBlackjack: boolean;
  readonly dealerBust: boolean;
  readonly net: number;
}

export interface GameState {
  readonly rules: RuleSet;
  readonly rng: RngState;
  readonly shoe: Shoe;
  /** Cents. Bets are taken out when placed and payouts added at settlement. */
  readonly bankroll: number;
  readonly phase: Phase;
  readonly round: number;
  readonly hands: readonly PlayerHand[];
  readonly activeHand: number;
  readonly dealer: readonly Card[];
  /** null when insurance was never offered this round; 0 when declined. */
  readonly insuranceBet: number | null;
  /** Early-surrender games defer the dealer's peek until the player's first decision. */
  readonly peekPending: boolean;
  /** True when the shoe was reshuffled before this round's deal. */
  readonly reshuffled: boolean;
  readonly result: RoundResult | null;
}

export type GameAction =
  | { readonly type: 'deal'; readonly bet: number }
  | { readonly type: 'insurance'; readonly take: boolean }
  | { readonly type: PlayerMove };

export interface CreateGameOptions {
  readonly bankroll: number;
  readonly seed?: number;
  /** Deal from this shoe instead of shuffling one. Mainly for tests and replays. */
  readonly shoe?: Shoe;
}

export function createGame(rules: RuleSet, options: CreateGameOptions): GameState {
  validateRules(rules);
  if (!Number.isInteger(options.bankroll) || options.bankroll < 0) {
    throw new GameError('INVALID_BET', 'bankroll must be a non-negative integer number of cents');
  }
  let rng = seedRng(options.seed ?? randomSeed());
  let shoe = options.shoe;
  if (!shoe) {
    const fresh = createShoe(rules, rng);
    shoe = fresh.shoe;
    rng = fresh.rng;
  }
  return {
    rules,
    rng,
    shoe,
    bankroll: options.bankroll,
    phase: 'betting',
    round: 0,
    hands: [],
    activeHand: 0,
    dealer: [],
    insuranceBet: null,
    peekPending: false,
    reshuffled: false,
    result: null,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function currentHand(state: GameState): PlayerHand | null {
  return state.phase === 'playerTurn' ? (state.hands[state.activeHand] ?? null) : null;
}

export function dealerUpcard(state: GameState): Card | null {
  return state.dealer[0] ?? null;
}

/**
 * Every card a player at the table has seen since the last shuffle, in deal order:
 * burn cards and a face-down hole card are excluded. This is what a counter counts.
 */
export function visibleCards(state: GameState): readonly Card[] {
  const hole = state.rules.holeCard === 'peek' && state.phase !== 'roundOver' ? state.dealer[1] : undefined;
  return dealtCards(state.shoe)
    .slice(state.shoe.burned)
    .filter((c) => c.id !== hole?.id);
}

export function canDouble(state: GameState): boolean {
  const hand = currentHand(state);
  if (!hand || hand.cards.length !== 2 || state.bankroll < hand.baseBet) return false;
  if (hand.fromSplit && !state.rules.doubleAfterSplit) return false;
  if (hand.splitAces && !state.rules.hitSplitAces) return false;
  return doubleRuleAllows(state.rules, hand.cards);
}

/** Whether the table's double-down restriction permits doubling this two-card hand. */
export function doubleRuleAllows(rules: Pick<RuleSet, 'doubleOn'>, cards: readonly Pick<Card, 'rank'>[]): boolean {
  const { total, soft } = handTotal(cards);
  switch (rules.doubleOn) {
    case 'any':
      return true;
    case '9-11':
      return !soft && total >= 9 && total <= 11;
    case '10-11':
      return !soft && total >= 10 && total <= 11;
  }
}

export function canSplit(state: GameState): boolean {
  const hand = currentHand(state);
  if (!hand || !isPair(hand.cards) || state.bankroll < hand.baseBet) return false;
  if (state.hands.length >= state.rules.maxHands) return false;
  return !hand.splitAces || state.rules.resplitAces;
}

export function canSurrender(state: GameState): boolean {
  const hand = currentHand(state);
  return (
    hand !== null &&
    state.rules.surrender !== 'none' &&
    state.hands.length === 1 &&
    hand.cards.length === 2 &&
    !hand.fromSplit
  );
}

export function canHit(state: GameState): boolean {
  const hand = currentHand(state);
  return hand !== null && (!hand.splitAces || state.rules.hitSplitAces);
}

export function legalMoves(state: GameState): readonly PlayerMove[] {
  if (state.phase !== 'playerTurn') return [];
  const moves: PlayerMove[] = [];
  if (canHit(state)) moves.push('hit');
  moves.push('stand');
  if (canDouble(state)) moves.push('double');
  if (canSplit(state)) moves.push('split');
  if (canSurrender(state)) moves.push('surrender');
  return moves;
}

export function insuranceCost(state: GameState): number {
  return Math.floor((state.hands[0]?.baseBet ?? 0) / 2);
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

export function applyAction(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'deal':
      return deal(state, action.bet);
    case 'insurance':
      return insurance(state, action.take);
    case 'surrender':
      return surrender(state);
    case 'hit':
    case 'stand':
    case 'double':
    case 'split':
      return playerMove(state, action.type);
  }
}

function illegal(message: string): never {
  throw new GameError('ILLEGAL_ACTION', message);
}

function deal(state: GameState, bet: number): GameState {
  if (state.phase !== 'betting' && state.phase !== 'roundOver') illegal(`cannot deal during ${state.phase}`);
  const { rules } = state;
  if (!Number.isInteger(bet) || bet < rules.minBet || bet > rules.maxBet) {
    throw new GameError('INVALID_BET', `bet must be a whole number of cents between ${rules.minBet} and ${rules.maxBet}`);
  }
  if (bet > state.bankroll) throw new GameError('INSUFFICIENT_FUNDS', 'bet exceeds bankroll');

  let s: GameState = {
    ...state,
    phase: 'playerTurn',
    round: state.round + 1,
    bankroll: state.bankroll - bet,
    hands: [],
    activeHand: 0,
    dealer: [],
    insuranceBet: null,
    peekPending: false,
    reshuffled: false,
    result: null,
  };
  if (isPastCutCard(s.shoe)) {
    const fresh = createShoe(rules, s.rng);
    s = { ...s, shoe: fresh.shoe, rng: fresh.rng, reshuffled: true };
  }

  // Player, dealer, player, then the hole card only in peek games.
  const draws: Card[] = [];
  const count = rules.holeCard === 'peek' ? 4 : 3;
  for (let i = 0; i < count; i++) {
    const r = draw(s);
    s = r.state;
    draws.push(r.card);
  }
  const [p1, d1, p2, d2] = draws as [Card, Card, Card, Card | undefined];
  s = {
    ...s,
    hands: [
      {
        cards: [p1, p2],
        baseBet: bet,
        bet,
        doubled: false,
        fromSplit: false,
        splitAces: false,
        status: isNatural([p1, p2]) ? 'blackjack' : 'active',
      },
    ],
    dealer: d2 ? [d1, d2] : [d1],
  };

  if (rules.insurance && cardValue(d1) === 1) return { ...s, phase: 'insurance' };
  return afterInsurance(s);
}

function insurance(state: GameState, take: boolean): GameState {
  if (state.phase !== 'insurance') illegal('insurance is not on offer');
  const cost = insuranceCost(state);
  if (take && cost > state.bankroll) throw new GameError('INSUFFICIENT_FUNDS', 'cannot cover insurance');
  return afterInsurance({
    ...state,
    phase: 'playerTurn',
    bankroll: take ? state.bankroll - cost : state.bankroll,
    insuranceBet: take ? cost : 0,
  });
}

function afterInsurance(state: GameState): GameState {
  const up = state.dealer[0];
  const dealerMayHaveNatural = up !== undefined && (cardValue(up) === 1 || cardValue(up) === 10);
  if (state.rules.holeCard === 'peek' && dealerMayHaveNatural) {
    if (state.rules.surrender === 'early') return advance({ ...state, peekPending: true });
    if (isNatural(state.dealer)) return settle(state);
  }
  return advance(state);
}

/** Early surrender: the dealer checks for blackjack as soon as the player commits to playing on. */
function resolvePendingPeek(state: GameState): GameState {
  if (!state.peekPending) return state;
  const s = { ...state, peekPending: false };
  return isNatural(s.dealer) ? settle(s) : s;
}

function surrender(state: GameState): GameState {
  if (!canSurrender(state)) illegal('surrender is not available');
  const hand = state.hands[state.activeHand] as PlayerHand;
  // Late surrender happens after the peek; early surrender beats it.
  const s = state.rules.surrender === 'early' ? { ...state, peekPending: false } : resolvePendingPeek(state);
  if (s.phase !== 'playerTurn') return s;
  return advance(replaceHand(s, s.activeHand, { ...hand, status: 'surrendered' }));
}

function playerMove(state: GameState, move: Exclude<PlayerMove, 'surrender'>): GameState {
  if (state.phase !== 'playerTurn') illegal(`cannot ${move} during ${state.phase}`);
  const allowed =
    move === 'stand' ||
    (move === 'hit' && canHit(state)) ||
    (move === 'double' && canDouble(state)) ||
    (move === 'split' && canSplit(state));
  if (!allowed) illegal(`${move} is not available`);

  const s = resolvePendingPeek(state);
  if (s.phase !== 'playerTurn') return s;

  const i = s.activeHand;
  const hand = s.hands[i] as PlayerHand;
  switch (move) {
    case 'stand':
      return advance(replaceHand(s, i, { ...hand, status: 'stood' }));
    case 'hit': {
      const r = draw(s);
      const cards = [...hand.cards, r.card];
      return advance(replaceHand(r.state, i, { ...hand, cards, status: statusAfterCard(cards) }));
    }
    case 'double': {
      const r = draw({ ...s, bankroll: s.bankroll - hand.baseBet });
      const cards = [...hand.cards, r.card];
      const status = isBust(cards) ? 'bust' : 'stood';
      return advance(replaceHand(r.state, i, { ...hand, cards, bet: hand.bet + hand.baseBet, doubled: true, status }));
    }
    case 'split': {
      const [a, b] = hand.cards as [Card, Card];
      const splitAces = cardValue(a) === 1;
      const base = { baseBet: hand.baseBet, bet: hand.baseBet, doubled: false, fromSplit: true, splitAces, status: 'active' } as const;
      const hands = [...s.hands.slice(0, i), { ...base, cards: [a] }, { ...base, cards: [b] }, ...s.hands.slice(i + 1)];
      return advance({ ...s, bankroll: s.bankroll - hand.baseBet, hands });
    }
  }
}

function statusAfterCard(cards: readonly Card[]): HandStatus {
  const { total } = handTotal(cards);
  if (total > 21) return 'bust';
  return total === 21 ? 'stood' : 'active';
}

/**
 * Moves play to the next hand still needing a decision, dealing the second card
 * to freshly split hands as they come up. Ends the round when none remain.
 */
function advance(state: GameState): GameState {
  let s = state;
  for (let i = s.activeHand; i < s.hands.length; i++) {
    let hand = s.hands[i] as PlayerHand;
    if (hand.status === 'active' && hand.cards.length === 1) {
      const r = draw(s);
      s = r.state;
      const cards = [...hand.cards, r.card];
      hand = { ...hand, cards, status: splitHandStatus(s, hand, cards) };
      s = replaceHand(s, i, hand);
    }
    if (hand.status === 'active') return { ...s, activeHand: i };
  }
  return finishRound(s);
}

function splitHandStatus(state: GameState, hand: PlayerHand, cards: readonly Card[]): HandStatus {
  const { rules } = state;
  if (hand.splitAces && !rules.hitSplitAces) {
    // Split aces get one card. They stay live only to be split again.
    const canResplit = rules.resplitAces && isPair(cards) && state.hands.length < rules.maxHands;
    return canResplit ? 'active' : 'stood';
  }
  // 21 on a split hand is a plain 21, never a blackjack.
  return handTotal(cards).total === 21 ? 'stood' : 'active';
}

function finishRound(state: GameState): GameState {
  let s: GameState = { ...state, peekPending: false };
  const live = s.hands.some((h) => h.status === 'stood');
  const needsHoleCard = live || s.hands.some((h) => h.status === 'blackjack') || (s.insuranceBet ?? 0) > 0;

  if (s.dealer.length === 1 && needsHoleCard) s = dealToDealer(s);
  if (live && !isNatural(s.dealer)) {
    while (dealerShouldHit(s)) s = dealToDealer(s);
  }
  return settle(s);
}

function dealerShouldHit(state: GameState): boolean {
  const { total, soft } = handTotal(state.dealer);
  return total < 17 || (total === 17 && soft && state.rules.dealerHitsSoft17);
}

function dealToDealer(state: GameState): GameState {
  const r = draw(state);
  return { ...r.state, dealer: [...r.state.dealer, r.card] };
}

function settle(state: GameState): GameState {
  const { rules } = state;
  const dealerBlackjack = isNatural(state.dealer);
  const dealerTotal = handTotal(state.dealer).total;
  const dealerBust = dealerTotal > 21;
  const [num, den] = rules.blackjackPays;

  const hands = state.hands.map((hand, i): HandResult => {
    const result = (outcome: Outcome, returned: number): HandResult => ({
      outcome,
      wagered: hand.bet,
      returned,
      net: returned - hand.bet,
    });
    if (hand.status === 'surrendered') return result('surrender', Math.floor(hand.bet / 2));

    if (dealerBlackjack) {
      if (hand.status === 'blackjack') return result('push', hand.bet);
      // Original-bets-only: the player loses the first hand's base bet and nothing else.
      if (rules.holeCard === 'enhc-obo') {
        return i === 0 ? result('lose', hand.bet - hand.baseBet) : result('push', hand.bet);
      }
      return result(hand.status === 'bust' ? 'bust' : 'lose', 0);
    }

    if (hand.status === 'bust') return result('bust', 0);
    if (hand.status === 'blackjack') return result('blackjack', hand.bet + Math.floor((hand.bet * num) / den));

    const { total } = handTotal(hand.cards);
    if (dealerBust || total > dealerTotal) return result('win', hand.bet * 2);
    if (total === dealerTotal) return result('push', hand.bet);
    return result('lose', 0);
  });

  const ins = state.insuranceBet;
  const insurance: HandResult | null =
    ins !== null && ins > 0
      ? dealerBlackjack
        ? { outcome: 'win', wagered: ins, returned: ins * 3, net: ins * 2 }
        : { outcome: 'lose', wagered: ins, returned: 0, net: -ins }
      : null;

  const all = insurance ? [...hands, insurance] : hands;
  const returned = all.reduce((sum, r) => sum + r.returned, 0);
  const net = all.reduce((sum, r) => sum + r.net, 0);

  return {
    ...state,
    phase: 'roundOver',
    peekPending: false,
    bankroll: state.bankroll + returned,
    result: { hands, insurance, dealerTotal, dealerBlackjack, dealerBust, net },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function replaceHand(state: GameState, index: number, hand: PlayerHand): GameState {
  return { ...state, hands: state.hands.map((h, i) => (i === index ? hand : h)) };
}

function cardsOnTable(state: GameState): Set<number> {
  return new Set([...state.dealer, ...state.hands.flatMap((h) => h.cards)].map((c) => c.id));
}

/**
 * Draws the next card. If a long round runs the shoe dry (rare, past the cut card
 * with several splits), the discards are reshuffled into a new shoe the way a
 * dealer would, leaving cards on the table where they are.
 */
function draw(state: GameState): { card: Card; state: GameState } {
  const r = drawFrom(state.shoe);
  if (r) return { card: r.card, state: { ...state, shoe: r.shoe } };

  const inPlay = cardsOnTable(state);
  const discards = createCards(state.rules.decks).filter((c) => !inPlay.has(c.id));
  const shuffled = shuffle(discards, state.rng);
  const first = shuffled.items[0];
  if (!first) throw new GameError('ILLEGAL_ACTION', 'no cards left to deal');
  const shoe: Shoe = { cards: shuffled.items, position: 1, cutCardIndex: 0, burned: 0 };
  return { card: first, state: { ...state, shoe, rng: shuffled.state } };
}
