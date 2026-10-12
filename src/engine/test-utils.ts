import { SUITS, type Card, type Rank } from './cards';
import { applyAction, createGame, type GameAction, type GameState } from './game';
import type { RuleSet } from './rules';
import { stackedShoe } from './shoe';

/** Cards with unique ids, cycling suits, e.g. `cards('A', '10', '7')`. */
export function cards(...ranks: Rank[]): Card[] {
  return ranks.map((rank, id) => ({ id: 1000 + id, rank, suit: SUITS[id % 4] ?? 'spades' }));
}

/** A game whose shoe deals exactly `ranks` in order. */
export function stackedGame(rules: RuleSet, ranks: Rank[], bankroll = 100_000): GameState {
  return createGame(rules, { bankroll, seed: 1, shoe: stackedShoe(cards(...ranks)) });
}

export function play(state: GameState, ...actions: GameAction[]): GameState {
  return actions.reduce(applyAction, state);
}
