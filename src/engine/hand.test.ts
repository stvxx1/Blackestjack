import { describe, expect, it } from 'vitest';
import { handTotal, isBust, isNatural, isPair, pairValue } from './hand';
import { cards } from './test-utils';

describe('hand totals', () => {
  it.each([
    [['10', '7'], 17, false],
    [['A', '6'], 17, true],
    [['A', '6', '10'], 17, false],
    [['A', 'A'], 12, true],
    [['A', 'A', '9'], 21, true],
    [['A', 'A', '10'], 12, false],
    [['A', '5', '5'], 21, true],
    [['K', 'Q', '2'], 22, false],
    [['A', 'A', 'A', 'A', '7'], 21, true],
  ] as const)('%j = %i (soft: %s)', (ranks, total, soft) => {
    expect(handTotal(cards(...ranks))).toEqual({ total, soft });
  });

  it('detects naturals, busts and pairs', () => {
    expect(isNatural(cards('A', 'K'))).toBe(true);
    expect(isNatural(cards('A', '5', '5'))).toBe(false);
    expect(isBust(cards('10', '6', '9'))).toBe(true);
    expect(isPair(cards('8', '8'))).toBe(true);
    expect(isPair(cards('J', 'K'))).toBe(true);
    expect(isPair(cards('8', '8', '8'))).toBe(false);
    expect(pairValue(cards('A', 'A'))).toBe(1);
    expect(pairValue(cards('9', '10'))).toBeNull();
  });
});
