import { CARDS_PER_DECK, createCards, type Card } from './cards';
import { nextInt, shuffle, type RngState } from './rng';
import type { RuleSet } from './rules';

export interface Shoe {
  readonly cards: readonly Card[];
  /** Index of the next card to be dealt. */
  readonly position: number;
  /** Once `position` reaches this index the current round finishes and the shoe is reshuffled. */
  readonly cutCardIndex: number;
}

export function createShoe(
  rules: Pick<RuleSet, 'decks' | 'penetration' | 'burnCards'>,
  rng: RngState,
): { shoe: Shoe; rng: RngState } {
  const shuffled = shuffle(createCards(rules.decks), rng);
  const total = shuffled.items.length;
  const [min, max] = rules.penetration;
  const lo = Math.floor(total * min);
  const hi = Math.floor(total * max);
  const cut = nextInt(shuffled.state, hi - lo + 1);
  return {
    shoe: { cards: shuffled.items, position: Math.min(rules.burnCards, total), cutCardIndex: lo + cut.value },
    rng: cut.state,
  };
}

/** A shoe dealt in exactly the given order, for tests and replays. */
export function stackedShoe(cards: readonly Card[], cutCardIndex = cards.length): Shoe {
  return { cards, position: 0, cutCardIndex };
}

export function cardsRemaining(shoe: Shoe): number {
  return shoe.cards.length - shoe.position;
}

export function decksRemaining(shoe: Shoe): number {
  return cardsRemaining(shoe) / CARDS_PER_DECK;
}

export function isPastCutCard(shoe: Shoe): boolean {
  return shoe.position >= shoe.cutCardIndex;
}

/** Cards already out of the shoe (including burns), in deal order. */
export function dealtCards(shoe: Shoe): readonly Card[] {
  return shoe.cards.slice(0, shoe.position);
}

export function drawFrom(shoe: Shoe): { card: Card; shoe: Shoe } | null {
  const card = shoe.cards[shoe.position];
  if (!card) return null;
  return { card, shoe: { ...shoe, position: shoe.position + 1 } };
}
