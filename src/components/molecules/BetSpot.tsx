import { AnimatePresence, motion } from 'framer-motion';
import { ChipFace } from '@/components/atoms/Chip';
import { chipStack } from '@/lib/chips';
import { money } from '@/lib/format';

/** The betting circle: a stacked pile of chips for the amount, with the total beneath. */
export function BetSpot({ amount, label = 'Bet', size = 46 }: { amount: number; label?: string; size?: number }) {
  const stack = chipStack(amount);
  return (
    <div className="flex flex-col items-center gap-1" aria-label={`${label}: ${money(amount)}`}>
      <div
        className="relative flex items-end justify-center rounded-full border-2 border-dashed border-brass-300/45"
        style={{ width: size * 1.55, height: size * 1.55 }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <AnimatePresence>
            {stack.map((chip, i) => (
              <motion.span
                key={`${i}-${chip.value}`}
                className="absolute"
                initial={{ y: 40, opacity: 0, scale: 0.8 }}
                animate={{ y: -i * 4, opacity: 1, scale: 1 }}
                exit={{ y: -60, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                style={{ zIndex: i }}
              >
                <ChipFace chip={chip} size={size} />
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      </div>
      <span className="tabular text-sm font-semibold text-brass-200">{amount > 0 ? money(amount) : label}</span>
    </div>
  );
}
