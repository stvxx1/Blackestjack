import { motion, type MotionProps } from 'framer-motion';
import type { Card } from '@/engine';
import { cardName, isRed, SUIT_SYMBOL } from '@/lib/cards';

interface PlayingCardProps {
  readonly card: Pick<Card, 'rank' | 'suit'>;
  readonly faceDown?: boolean;
  readonly size?: 'sm' | 'md' | 'lg';
  /** Seconds before the deal animation starts. */
  readonly dealDelay?: number;
  /** Animate in from the shoe (top right). Off for static displays like drills. */
  readonly dealt?: boolean;
  readonly className?: string;
}

const SIZE: Record<NonNullable<PlayingCardProps['size']>, string> = {
  sm: 'calc(var(--card-w) * 0.62)',
  md: 'var(--card-w)',
  lg: 'calc(var(--card-w) * 1.35)',
};

const FACE: Partial<Record<Card['rank'], string>> = { J: 'J', Q: 'Q', K: 'K' };

/**
 * A playing card drawn in CSS: corner indices, a centre pip (or a framed letter for
 * court cards), and a patterned back. Flipping animates a 3D turn.
 */
export function PlayingCard({ card, faceDown = false, size = 'md', dealDelay = 0, dealt = true, className = '' }: PlayingCardProps) {
  const red = isRed(card.suit);
  const symbol = SUIT_SYMBOL[card.suit];
  const width = SIZE[size];
  const court = FACE[card.rank];

  const enter: MotionProps = dealt
    ? {
        initial: { x: '40vw', y: '-30vh', rotate: -25, opacity: 0 },
        animate: { x: 0, y: 0, rotate: 0, opacity: 1 },
        transition: { type: 'spring', stiffness: 260, damping: 28, delay: dealDelay },
      }
    : { initial: false };

  return (
    <motion.div
      layout
      {...enter}
      className={`relative shrink-0 [perspective:800px] ${className}`}
      style={{ width, height: `calc(${width} * 1.4)` }}
      role="img"
      aria-label={faceDown ? 'Face-down card' : cardName(card)}
    >
      <motion.div
        className="absolute inset-0 [transform-style:preserve-3d]"
        initial={false}
        animate={{ rotateY: faceDown ? 180 : 0 }}
        transition={{ duration: 0.45, ease: [0.3, 0.7, 0.2, 1] }}
      >
        {/* Front */}
        <div
          className={`absolute inset-0 rounded-[8%/6%] border border-card-edge bg-card shadow-(--shadow-card) [backface-visibility:hidden] ${
            red ? 'text-card-red' : 'text-card-black'
          }`}
          aria-hidden
        >
          <Corner rank={card.rank} symbol={symbol} />
          <div className="absolute inset-0 flex items-center justify-center">
            {court ? (
              <span
                className="flex h-[52%] w-[56%] items-center justify-center rounded-sm border-2 border-current/40 font-display font-bold"
                style={{ fontSize: `calc(${width} * 0.42)` }}
              >
                {court}
              </span>
            ) : (
              <span style={{ fontSize: `calc(${width} * (${card.rank === 'A' ? 0.62 : 0.46}))` }} className="leading-none">
                {symbol}
              </span>
            )}
          </div>
          <Corner rank={card.rank} symbol={symbol} flipped />
        </div>
        {/* Back */}
        <div
          className="card-back absolute inset-0 rounded-[8%/6%] border-[3px] border-card shadow-(--shadow-card) [backface-visibility:hidden] [transform:rotateY(180deg)]"
          aria-hidden
        />
      </motion.div>
    </motion.div>
  );
}

function Corner({ rank, symbol, flipped = false }: { rank: string; symbol: string; flipped?: boolean }) {
  return (
    <span
      className={`absolute flex flex-col items-center font-semibold leading-[0.95] ${
        flipped ? 'right-[7%] bottom-[5%] rotate-180' : 'top-[5%] left-[7%]'
      }`}
      style={{ fontSize: 'calc(var(--card-w) * 0.2)' }}
    >
      <span className="tracking-tighter">{rank}</span>
      <span>{symbol}</span>
    </span>
  );
}
