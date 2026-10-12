import { cardValue, type Card, type CardValue } from './cards';

export interface HandTotal {
  readonly total: number;
  /** True when an ace is being counted as 11. */
  readonly soft: boolean;
}

type CardLike = Pick<Card, 'rank'>;

export function handTotal(cards: readonly CardLike[]): HandTotal {
  let total = 0;
  let hasAce = false;
  for (const card of cards) {
    const v = cardValue(card);
    total += v;
    if (v === 1) hasAce = true;
  }
  if (hasAce && total + 10 <= 21) return { total: total + 10, soft: true };
  return { total, soft: false };
}

/** Two-card 21. Callers decide whether a split hand is eligible (it never is). */
export function isNatural(cards: readonly CardLike[]): boolean {
  return cards.length === 2 && handTotal(cards).total === 21;
}

export function isBust(cards: readonly CardLike[]): boolean {
  return handTotal(cards).total > 21;
}

/** Two cards of equal blackjack value (so 10-K counts as a pair, as at most tables). */
export function isPair(cards: readonly CardLike[]): boolean {
  const [a, b] = cards;
  return cards.length === 2 && a !== undefined && b !== undefined && cardValue(a) === cardValue(b);
}

export function pairValue(cards: readonly CardLike[]): CardValue | null {
  const first = cards[0];
  return isPair(cards) && first ? cardValue(first) : null;
}
