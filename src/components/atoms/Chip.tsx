import type { ChipDenomination } from '@/lib/chips';

const TONE: Record<ChipDenomination['tone'], string> = {
  red: 'var(--color-chip-red)',
  green: 'var(--color-chip-green)',
  black: 'var(--color-chip-black)',
  purple: 'var(--color-chip-purple)',
  gold: 'var(--color-chip-gold)',
};

interface ChipFaceProps {
  readonly chip: ChipDenomination;
  readonly size?: number;
  readonly className?: string;
}

/** A casino chip: coloured body, striped edge inserts, inner ring with the value. */
export function ChipFace({ chip, size = 52, className = '' }: ChipFaceProps) {
  const color = TONE[chip.tone];
  return (
    <span
      aria-hidden
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full shadow-[0_3px_0_rgb(0_0_0/0.45),0_6px_10px_-4px_rgb(0_0_0/0.6)] ${className}`}
      style={{
        width: size,
        height: size,
        background: `repeating-conic-gradient(from 0deg, ${color} 0deg 30deg, #f4efe2 30deg 45deg)`,
      }}
    >
      <span
        className="absolute rounded-full"
        style={{ inset: size * 0.12, background: color, boxShadow: 'inset 0 0 0 2px rgb(255 255 255 / 0.55)' }}
      />
      <span
        className="relative font-bold text-white drop-shadow-[0_1px_0_rgb(0_0_0/0.6)]"
        style={{ fontSize: size * (chip.label.length > 2 ? 0.26 : 0.32) }}
      >
        {chip.label}
      </span>
    </span>
  );
}
