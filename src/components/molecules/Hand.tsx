import { AnimatePresence, motion } from 'framer-motion';
import type { Card, HandResult } from '@/engine';
import { PlayingCard } from '@/components/atoms/PlayingCard';
import { signedMoney } from '@/lib/format';

interface HandProps {
  readonly label: string;
  readonly cards: readonly Card[];
  /** Badge text, e.g. "Soft 17". */
  readonly total: string;
  readonly active?: boolean;
  readonly faceDownIndex?: number;
  readonly dealDelay?: (index: number) => number;
  readonly result?: HandResult | null;
  readonly footer?: React.ReactNode;
  readonly compact?: boolean;
}

const OUTCOME: Record<HandResult['outcome'], { text: string; tone: string }> = {
  blackjack: { text: 'Blackjack', tone: 'bg-brass-400 text-felt-950' },
  win: { text: 'Win', tone: 'bg-good text-felt-950' },
  push: { text: 'Push', tone: 'bg-white/80 text-felt-950' },
  lose: { text: 'Lose', tone: 'bg-bad text-white' },
  bust: { text: 'Bust', tone: 'bg-bad text-white' },
  surrender: { text: 'Surrender', tone: 'bg-white/70 text-felt-950' },
};

/** A fanned hand with its total badge, an active-hand glow and an outcome ribbon. */
export function Hand({ label, cards, total, active = false, faceDownIndex, dealDelay, result, footer, compact = false }: HandProps) {
  const overlap = compact ? 'calc(var(--card-w) * -0.62)' : 'calc(var(--card-w) * -0.55)';
  return (
    <motion.section
      layout
      aria-label={`${label}: ${total || 'no cards'}${active ? ', your move' : ''}`}
      className={`relative flex flex-col items-center gap-2 rounded-2xl px-2 pt-2 pb-1 transition-[background,box-shadow] ${
        active ? 'bg-white/[0.07] shadow-[0_0_0_2px_var(--color-brass-300),0_0_30px_-6px_var(--color-brass-400)]' : ''
      }`}
    >
      <div className="flex min-h-(--card-h) items-end">
        <AnimatePresence initial={false}>
          {cards.map((card, i) => (
            <div key={card.id} style={{ marginLeft: i === 0 ? 0 : overlap, zIndex: i }} className="relative">
              <PlayingCard card={card} faceDown={i === faceDownIndex} dealDelay={dealDelay?.(i) ?? 0} />
            </div>
          ))}
        </AnimatePresence>
      </div>
      <div className="flex min-h-7 items-center gap-2">
        {total && result?.outcome !== 'blackjack' && (
          <span className="tabular rounded-full bg-black/55 px-2.5 py-0.5 text-sm font-semibold text-ink ring-1 ring-white/15">
            {total}
          </span>
        )}
        <AnimatePresence>
          {result && (
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
              className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${OUTCOME[result.outcome].tone}`}
            >
              {OUTCOME[result.outcome].text}
              {result.net !== 0 && <span className="tabular ml-1.5 font-semibold">{signedMoney(result.net)}</span>}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      {footer}
    </motion.section>
  );
}
