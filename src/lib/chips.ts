export interface ChipDenomination {
  /** Cents. */
  readonly value: number;
  readonly label: string;
  /** CSS colour token name. */
  readonly tone: 'red' | 'green' | 'black' | 'purple' | 'gold';
}

/** Standard casino colours: $5 red, $25 green, $100 black, $500 purple, $1000 gold. */
export const CHIPS: readonly ChipDenomination[] = [
  { value: 500, label: '5', tone: 'red' },
  { value: 2_500, label: '25', tone: 'green' },
  { value: 10_000, label: '100', tone: 'black' },
  { value: 50_000, label: '500', tone: 'purple' },
  { value: 100_000, label: '1K', tone: 'gold' },
];

/** Greedy breakdown into chips, largest first, capped so stacks stay drawable. */
export function chipStack(cents: number, max = 12): ChipDenomination[] {
  const out: ChipDenomination[] = [];
  let left = cents;
  for (const chip of [...CHIPS].reverse()) {
    while (left >= chip.value && out.length < max) {
      out.push(chip);
      left -= chip.value;
    }
  }
  return out;
}
