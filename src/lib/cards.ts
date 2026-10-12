import { handTotal, isNatural, isPair, type Card, type Rank, type Suit } from '@/engine';

const RANK_NAMES: Readonly<Record<Rank, string>> = {
  A: 'Ace', '2': 'Two', '3': 'Three', '4': 'Four', '5': 'Five', '6': 'Six', '7': 'Seven',
  '8': 'Eight', '9': 'Nine', '10': 'Ten', J: 'Jack', Q: 'Queen', K: 'King',
};

export const SUIT_SYMBOL: Readonly<Record<Suit, string>> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };

export const isRed = (suit: Suit): boolean => suit === 'hearts' || suit === 'diamonds';

export function cardName(card: Pick<Card, 'rank' | 'suit'>): string {
  return `${RANK_NAMES[card.rank]} of ${card.suit}`;
}

/** "Soft 17", "Blackjack", "Bust (24)", "20"; a lone card reads as itself ("A", "10"). */
export function describeTotal(cards: readonly Pick<Card, 'rank'>[], options: { natural?: boolean } = {}): string {
  if (cards.length === 0) return '';
  if (cards.length === 1 && cards[0]) return cards[0].rank === 'A' ? 'A' : String(handTotal(cards).total);
  if ((options.natural ?? true) && isNatural(cards)) return 'Blackjack';
  const { total, soft } = handTotal(cards);
  if (total > 21) return `Bust (${total})`;
  // A soft 21 is just "21" to a player.
  return soft && total < 21 ? `Soft ${total}` : String(total);
}

/** How a strategy chart names a hand: pairs as "8,8", otherwise like `describeTotal`. */
export function strategyLabel(cards: readonly Pick<Card, 'rank'>[]): string {
  const [a, b] = cards;
  if (cards.length === 2 && a && b && isPair(cards)) {
    const r = (c: Pick<Card, 'rank'>): string => (c.rank === 'A' ? 'A' : String(handTotal([c]).total));
    return `${r(a)},${r(b)}`;
  }
  return describeTotal(cards);
}

/** "an ace", "a 10", "an 8": the dealer's upcard in a sentence. */
export function upcardPhrase(card: Pick<Card, 'rank'>): string {
  if (card.rank === 'A') return 'an ace';
  const v = handTotal([card]).total;
  return v === 8 ? 'an 8' : `a ${v}`;
}

/** Compact badge text: "S17", "BJ", "24". */
export function shortTotal(cards: readonly Pick<Card, 'rank'>[], options: { natural?: boolean } = {}): string {
  if (cards.length === 0) return '';
  if ((options.natural ?? true) && isNatural(cards)) return 'BJ';
  const { total, soft } = handTotal(cards);
  return soft && total < 21 ? `${total - 10}/${total}` : String(total);
}
