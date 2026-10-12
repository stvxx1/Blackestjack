import { AnimatePresence, motion } from 'framer-motion';
import type { DecisionFeedback } from '@/state/gameStore';
import { money } from '@/lib/format';

const MOVE_LABEL: Record<DecisionFeedback['chose'], string> = {
  hit: 'Hit',
  stand: 'Stand',
  double: 'Double',
  split: 'Split',
  surrender: 'Surrender',
  insure: 'Take insurance',
  decline: 'Decline insurance',
};

export function CoachToast({ feedback }: { feedback: DecisionFeedback | null }) {
  return (
    <div aria-live="polite" className="pointer-events-none flex min-h-10 justify-center">
      <AnimatePresence mode="popLayout">
        {feedback && (
          <motion.div
            key={`${feedback.round}-${feedback.chose}-${feedback.correct}-${feedback.evLost}`}
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium shadow-lg ring-1 backdrop-blur ${
              feedback.isCorrect ? 'bg-good/15 text-good ring-good/40' : 'bg-bad/15 text-[#ffb3ad] ring-bad/50'
            }`}
          >
            <span aria-hidden className="text-base">
              {feedback.isCorrect ? '✓' : '✗'}
            </span>
            {feedback.isCorrect ? (
              <span>
                {MOVE_LABEL[feedback.chose]} — correct
                {feedback.deviation && <span className="text-ink-2"> · index play {feedback.deviation}</span>}
              </span>
            ) : (
              <span>
                Should {MOVE_LABEL[feedback.correct].toLowerCase()}
                {feedback.deviation && <span> ({feedback.deviation} index)</span>}
                {feedback.evLost > 0 && <span className="text-ink-2"> · cost {money(feedback.evLost)} EV</span>}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
