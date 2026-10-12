import type { Shoe } from '@/engine';

const STACK_MAX = 64;

/**
 * Discard tray (left) and shoe (right), drawn as card-edge stacks so decks remaining can be
 * eyeballed the way you would at a real table. The red line on the shoe is the cut card.
 */
export function ShoeAndTray({ shoe, side }: { shoe: Shoe; side: 'tray' | 'shoe' }) {
  const total = shoe.cards.length;
  const dealt = shoe.position;
  const fraction = side === 'shoe' ? (total - dealt) / total : dealt / total;
  const height = Math.max(2, Math.round(fraction * STACK_MAX));
  const cutFromTop = side === 'shoe' ? Math.round(((shoe.cutCardIndex - dealt) / total) * STACK_MAX) : null;
  const label =
    side === 'shoe'
      ? `Shoe: ${(total - dealt) / 52 >= 1 ? ((total - dealt) / 52).toFixed(1) : ((total - dealt) / 52).toFixed(2)} decks left`
      : `Discard tray: ${(dealt / 52).toFixed(1)} decks`;
  return (
    <div className="flex flex-col items-center gap-1" role="img" aria-label={label}>
      <div className="relative flex h-16 w-12 items-end justify-center rounded-md bg-black/30 ring-1 ring-white/10">
        <div
          className="w-9 rounded-[3px] bg-[repeating-linear-gradient(0deg,#f4efe2_0_1px,#cfc7b4_1px_2px)] shadow-md transition-[height] duration-500"
          style={{ height }}
        />
        {cutFromTop !== null && cutFromTop > 0 && cutFromTop < height && (
          <div className="absolute h-0.5 w-11 rounded bg-card-red" style={{ bottom: height - cutFromTop }} />
        )}
      </div>
      <span className="text-[0.65rem] tracking-wide text-ink-3 uppercase">{side === 'shoe' ? 'Shoe' : 'Discards'}</span>
    </div>
  );
}
