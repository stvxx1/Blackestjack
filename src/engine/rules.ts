import { GameError } from './errors';

/**
 * - `peek`: US style. Dealer takes a hole card and checks for blackjack under a 10 or ace
 *   before anyone acts, so doubles and splits are never lost to a dealer natural.
 * - `enhc`: European no-hole-card, the norm in Australia. The dealer's second card comes
 *   after the players act, and a dealer blackjack takes every bet on the table, doubles
 *   and splits included.
 * - `enhc-obo`: no hole card, but only the original bet is lost to a dealer blackjack.
 */
export type HoleCardRule = 'peek' | 'enhc' | 'enhc-obo';
export type SurrenderRule = 'none' | 'late' | 'early';
/** Which hard two-card totals may be doubled. */
export type DoubleRule = 'any' | '9-11' | '10-11';

export interface RuleSet {
  readonly name: string;
  readonly decks: number;
  readonly dealerHitsSoft17: boolean;
  readonly holeCard: HoleCardRule;
  /** Payout ratio for a natural, e.g. 3:2 or 6:5. */
  readonly blackjackPays: readonly [numerator: number, denominator: number];
  readonly doubleOn: DoubleRule;
  readonly doubleAfterSplit: boolean;
  readonly surrender: SurrenderRule;
  /** Total hands a player can end up with after splitting (2 = no resplits). */
  readonly maxHands: number;
  readonly resplitAces: boolean;
  readonly hitSplitAces: boolean;
  readonly insurance: boolean;
  /** Cut card is placed uniformly at random between these fractions of the shoe. */
  readonly penetration: readonly [min: number, max: number];
  readonly burnCards: number;
  /** Table limits in cents. */
  readonly minBet: number;
  readonly maxBet: number;
}

/**
 * A typical Australian casino game (Crown / The Star style): 6 decks, dealer stands
 * on soft 17, no hole card with all bets lost to a dealer natural, no surrender.
 * House rules vary by venue and table, so treat this as a sensible default and
 * override per venue rather than as gospel.
 */
export const AU_CASINO: RuleSet = {
  name: 'Australian Casino (6D, S17, ENHC)',
  decks: 6,
  dealerHitsSoft17: false,
  holeCard: 'enhc',
  blackjackPays: [3, 2],
  doubleOn: 'any',
  doubleAfterSplit: true,
  surrender: 'none',
  maxHands: 4,
  resplitAces: false,
  hitSplitAces: false,
  insurance: true,
  penetration: [0.7, 0.8],
  burnCards: 1,
  minBet: 2_500,
  maxBet: 1_000_000,
};

export const VEGAS_STRIP: RuleSet = {
  name: 'Vegas Strip (6D, S17, DAS, LS)',
  decks: 6,
  dealerHitsSoft17: false,
  holeCard: 'peek',
  blackjackPays: [3, 2],
  doubleOn: 'any',
  doubleAfterSplit: true,
  surrender: 'late',
  maxHands: 4,
  resplitAces: true,
  hitSplitAces: false,
  insurance: true,
  penetration: [0.75, 0.8],
  burnCards: 1,
  minBet: 2_500,
  maxBet: 1_000_000,
};

export const ATLANTIC_CITY: RuleSet = {
  name: 'Atlantic City (8D, S17, DAS, LS)',
  decks: 8,
  dealerHitsSoft17: false,
  holeCard: 'peek',
  blackjackPays: [3, 2],
  doubleOn: 'any',
  doubleAfterSplit: true,
  surrender: 'late',
  maxHands: 4,
  resplitAces: false,
  hitSplitAces: false,
  insurance: true,
  penetration: [0.7, 0.75],
  burnCards: 1,
  minBet: 1_000,
  maxBet: 500_000,
};

export const VEGAS_DOWNTOWN_H17: RuleSet = {
  ...VEGAS_STRIP,
  name: 'Vegas Downtown (6D, H17, DAS, LS)',
  dealerHitsSoft17: true,
  resplitAces: false,
};

export const RULE_PRESETS = {
  'au-casino': AU_CASINO,
  'vegas-strip': VEGAS_STRIP,
  'atlantic-city': ATLANTIC_CITY,
  'vegas-downtown-h17': VEGAS_DOWNTOWN_H17,
} as const satisfies Record<string, RuleSet>;

export type PresetId = keyof typeof RULE_PRESETS;

export function isPresetId(value: unknown): value is PresetId {
  return typeof value === 'string' && Object.hasOwn(RULE_PRESETS, value);
}

export function validateRules(rules: RuleSet): RuleSet {
  const fail = (msg: string): never => {
    throw new GameError('INVALID_RULES', `${rules.name}: ${msg}`);
  };
  if (!Number.isInteger(rules.decks) || rules.decks < 1 || rules.decks > 8) fail('decks must be 1-8');
  if (!Number.isInteger(rules.maxHands) || rules.maxHands < 1 || rules.maxHands > 4) fail('maxHands must be 1-4');
  const [num, den] = rules.blackjackPays;
  if (!(num > 0 && den > 0)) fail('blackjackPays must be positive');
  const [lo, hi] = rules.penetration;
  if (!(lo > 0 && lo <= hi && hi <= 0.95)) fail('penetration must satisfy 0 < min <= max <= 0.95');
  if (!Number.isInteger(rules.burnCards) || rules.burnCards < 0) fail('burnCards must be a non-negative integer');
  if (!Number.isInteger(rules.minBet) || rules.minBet <= 0) fail('minBet must be a positive integer (cents)');
  if (!Number.isInteger(rules.maxBet) || rules.maxBet < rules.minBet) fail('maxBet must be >= minBet');
  if (rules.surrender === 'early' && rules.holeCard !== 'peek') fail('early surrender requires a peek game');
  return rules;
}
