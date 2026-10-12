import { describe, expect, it } from 'vitest';
import { cardLabel, cardValue, createCards } from './cards';
import { seedRng } from './rng';
import { AU_CASINO } from './rules';
import { cardsRemaining, createShoe, dealtCards, decksRemaining, drawFrom, isPastCutCard, stackedShoe } from './shoe';

describe('cards', () => {
  it('builds full decks with unique ids', () => {
    const c = createCards(6);
    expect(c).toHaveLength(312);
    expect(new Set(c.map((x) => x.id)).size).toBe(312);
    expect(c.filter((x) => x.rank === 'A' && x.suit === 'hearts')).toHaveLength(6);
    expect(c.filter((x) => cardValue(x) === 10)).toHaveLength(96);
  });

  it('labels cards', () => {
    expect(cardLabel({ rank: '10', suit: 'hearts' })).toBe('10♥');
  });
});

describe('shoe', () => {
  it('places the cut card within the penetration window and burns a card', () => {
    for (let seed = 0; seed < 200; seed++) {
      const { shoe } = createShoe(AU_CASINO, seedRng(seed));
      expect(shoe.cutCardIndex).toBeGreaterThanOrEqual(Math.floor(312 * 0.7));
      expect(shoe.cutCardIndex).toBeLessThanOrEqual(Math.floor(312 * 0.8));
      expect(shoe.position).toBe(1);
    }
  });

  it('is reproducible from a seed', () => {
    expect(createShoe(AU_CASINO, seedRng(5)).shoe).toEqual(createShoe(AU_CASINO, seedRng(5)).shoe);
  });

  it('draws in order and reports what is left', () => {
    let shoe = stackedShoe(createCards(1), 40);
    expect(decksRemaining(shoe)).toBe(1);
    const first = drawFrom(shoe);
    expect(first?.card.id).toBe(0);
    shoe = first?.shoe ?? shoe;
    expect(cardsRemaining(shoe)).toBe(51);
    expect(dealtCards(shoe).map((c) => c.id)).toEqual([0]);
    expect(isPastCutCard(shoe)).toBe(false);
    expect(isPastCutCard({ ...shoe, position: 40 })).toBe(true);
    expect(drawFrom({ ...shoe, position: 52 })).toBeNull();
  });
});
