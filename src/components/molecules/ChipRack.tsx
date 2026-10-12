import { ChipFace } from '@/components/atoms/Chip';
import { CHIPS } from '@/lib/chips';
import { money } from '@/lib/format';

interface ChipRackProps {
  readonly available: number;
  readonly onAdd: (cents: number) => void;
}

/** Chip buttons, $5 to $1K, with number-key shortcuts 1-5. */
export function ChipRack({ available, onAdd }: ChipRackProps) {
  return (
    <div role="group" aria-label="Add chips to your bet" className="flex items-center gap-1.5 sm:gap-2.5">
      {CHIPS.map((chip, i) => (
        <button
          key={chip.value}
          type="button"
          disabled={chip.value > available}
          aria-label={`Add ${money(chip.value)}`}
          aria-keyshortcuts={String(i + 1)}
          onClick={() => {
            onAdd(chip.value);
          }}
          className="group relative rounded-full transition-transform hover:-translate-y-1 active:translate-y-0 disabled:opacity-30 disabled:hover:translate-y-0"
        >
          <ChipFace chip={chip} size={46} className="max-sm:scale-90" />
          <span className="absolute -bottom-1 left-1/2 hidden -translate-x-1/2 rounded bg-black/70 px-1 text-[0.6rem] font-semibold text-ink-2 sm:block">
            {i + 1}
          </span>
        </button>
      ))}
    </div>
  );
}
