import { describe, expect, it } from 'vitest';
import { chipStack } from './chips';
import { describeTotal, shortTotal, strategyLabel, upcardPhrase } from './cards';
import { compactMoney, money, percent, signed, signedMoney } from './format';
import { cards } from '@/engine/test-utils';

describe('money formatting (AUD)', () => {
  it('drops cents on whole dollars and keeps them otherwise', () => {
    expect(money(2_500)).toBe('$25');
    expect(money(3_750)).toBe('$37.50');
    expect(money(100_000)).toBe('$1,000');
  });
  it('signs with a true minus', () => {
    expect(signedMoney(1_250)).toBe('+$12.50');
    expect(signedMoney(-2_500)).toBe('−$25');
    expect(signedMoney(0)).toBe('$0');
    expect(signed(-3)).toBe('−3');
    expect(signed(2)).toBe('+2');
    expect(signed(0)).toBe('0');
  });
  it('compacts large sums', () => {
    expect(compactMoney(50_000)).toBe('$500');
    expect(compactMoney(250_000_00)).toBe('$250K');
    expect(percent(0.1234)).toBe('12.3%');
  });
});

describe('chips', () => {
  it('breaks a bet into the fewest chips, largest first', () => {
    expect(chipStack(13_000).map((c) => c.value)).toEqual([10_000, 2_500, 500]);
    expect(chipStack(0)).toEqual([]);
    expect(chipStack(10_000_000, 12)).toHaveLength(12);
  });
});

describe('card text', () => {
  it('describes totals the way players say them', () => {
    expect(describeTotal(cards('A', 'K'))).toBe('Blackjack');
    expect(describeTotal(cards('A', 'K'), { natural: false })).toBe('21');
    expect(describeTotal(cards('A', '6'))).toBe('Soft 17');
    expect(describeTotal(cards('10', '6', '9'))).toBe('Bust (25)');
    expect(describeTotal(cards('A'))).toBe('A');
    expect(describeTotal(cards('Q'))).toBe('10');
    expect(describeTotal([])).toBe('');
  });
  it('names pairs as pairs for the strategy chart', () => {
    expect(strategyLabel(cards('8', '8'))).toBe('8,8');
    expect(strategyLabel(cards('A', 'A'))).toBe('A,A');
    expect(strategyLabel(cards('J', 'K'))).toBe('10,10');
    expect(strategyLabel(cards('10', '6'))).toBe('16');
  });
  it('phrases upcards and short totals', () => {
    expect(upcardPhrase({ rank: 'A' })).toBe('an ace');
    expect(upcardPhrase({ rank: '8' })).toBe('an 8');
    expect(upcardPhrase({ rank: 'K' })).toBe('a 10');
    expect(shortTotal(cards('A', '6'))).toBe('7/17');
    expect(shortTotal(cards('A', 'K'))).toBe('BJ');
    expect(shortTotal(cards('10', '7'))).toBe('17');
  });
});
