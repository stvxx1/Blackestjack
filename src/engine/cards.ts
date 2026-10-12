export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'] as const;

export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];

/** Blackjack value of a card. Aces are 1 here; soft totals are resolved in `handTotal`. */
export type CardValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface Card {
  /** Unique within a shoe. Stable across renders, so it doubles as a React key. */
  readonly id: number;
  readonly rank: Rank;
  readonly suit: Suit;
}

export const CARDS_PER_DECK = 52;

const RANK_VALUES: Readonly<Record<Rank, CardValue>> = {
  A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 10, Q: 10, K: 10,
};

export function rankValue(rank: Rank): CardValue {
  return RANK_VALUES[rank];
}

export function cardValue(card: Pick<Card, 'rank'>): CardValue {
  return RANK_VALUES[card.rank];
}

/** Ordered, unshuffled cards for `decks` decks with ids 0..n-1. */
export function createCards(decks: number): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ id: cards.length, rank, suit });
      }
    }
  }
  return cards;
}

const SUIT_SYMBOLS: Readonly<Record<Suit, string>> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };

export function cardLabel(card: Pick<Card, 'rank' | 'suit'>): string {
  return `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
}
