const whole = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
const exact = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2 });
const compact = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  notation: 'compact',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

/** AUD from cents. Whole dollars drop the cents: $25, $37.50. */
export function money(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? whole.format(dollars) : exact.format(dollars);
}

/** Signed AUD from cents: +$25, −$12.50, $0. Uses a true minus sign. */
export function signedMoney(cents: number): string {
  if (cents === 0) return money(0);
  return `${cents > 0 ? '+' : '−'}${money(Math.abs(cents))}`;
}

/** Short AUD for tight spaces: $1.2K, $15K. */
export function compactMoney(cents: number): string {
  return Math.abs(cents) < 1_000_000 ? money(cents) : compact.format(cents / 100);
}

export function percent(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function signed(n: number, digits = 0): string {
  const s = Math.abs(n).toFixed(digits);
  if (n > 0) return `+${s}`;
  if (n < 0) return `−${s}`;
  return s;
}
