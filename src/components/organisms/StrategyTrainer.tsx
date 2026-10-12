import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { accuracy, RULE_PRESETS, type DrillCategory, type PlayerMove, type PresetId } from '@/engine';
import { Button } from '@/components/atoms/Button';
import { PlayingCard } from '@/components/atoms/PlayingCard';
import { Segmented } from '@/components/atoms/Segmented';
import { StatTile } from '@/components/atoms/StatTile';
import { useHotkeys } from '@/hooks/useHotkeys';
import { describeTotal, strategyLabel } from '@/lib/cards';
import { percent } from '@/lib/format';
import { trainerStore, useTrainerStore } from '@/state/trainerStore';
import { uiStore } from '@/state/uiStore';
import { playSound } from '@/services/sound';
import { ChartLegend, StrategyChart } from './StrategyChart';

const MOVES: readonly { move: PlayerMove; label: string; key: string }[] = [
  { move: 'hit', label: 'Hit', key: 'H' },
  { move: 'stand', label: 'Stand', key: 'S' },
  { move: 'double', label: 'Double', key: 'D' },
  { move: 'split', label: 'Split', key: 'P' },
  { move: 'surrender', label: 'Surrender', key: 'R' },
];

const CATEGORIES: readonly { value: DrillCategory; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'hard', label: 'Hard' },
  { value: 'soft', label: 'Soft' },
  { value: 'pairs', label: 'Pairs' },
];

const MOVE_NAME: Record<PlayerMove, string> = { hit: 'Hit', stand: 'Stand', double: 'Double', split: 'Split', surrender: 'Surrender' };

export function StrategyTrainer() {
  const { current, last, stats, category, presetId } = useTrainerStore((s) => s);
  const rules = RULE_PRESETS[presetId];
  const [chartTab, setChartTab] = useState<'hard' | 'soft' | 'pairs'>('hard');
  const { answer, setCategory, setPreset, resetStats } = trainerStore.getState();

  const submit = (move: PlayerMove): void => {
    if (!current.available.includes(move)) return;
    answer(move);
    const graded = trainerStore.getState().last;
    // Jump the chart to the table the hand belongs to, so the outlined cell is in view.
    const table = graded?.hand.cell.split(':')[0];
    setChartTab(table === 'pair' ? 'pairs' : table === 'soft' ? 'soft' : 'hard');
    if (uiStore.getState().sound) playSound(graded?.correct ? 'win' : 'lose');
  };

  useHotkeys({
    h: () => { submit('hit'); },
    s: () => { submit('stand'); },
    d: () => { submit('double'); },
    p: () => { submit('split'); },
    r: () => { submit('surrender'); },
  });


  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
      <section aria-labelledby="drill-title" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 id="drill-title" className="font-display text-2xl text-brass-200">
            Basic strategy drill
          </h1>
          <Segmented label="Hand type" value={category} options={CATEGORIES} onChange={setCategory} />
        </div>

        <div className="felt relative flex flex-col items-center gap-6 rounded-3xl px-4 py-8 shadow-[inset_0_0_60px_rgb(0_0_0/0.5)]">
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs tracking-widest text-ink-3 uppercase">Dealer shows</span>
            <AnimatePresence mode="popLayout">
              <motion.div key={`up-${current.cell}-${current.upcard.suit}-${stats.attempts}`} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <PlayingCard card={current.upcard} dealt={false} />
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex flex-col items-center gap-2">
            <AnimatePresence mode="popLayout">
              <motion.div
                key={`hand-${stats.attempts}`}
                className="flex"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                aria-label={`Your hand: ${describeTotal(current.cards)}`}
              >
                {current.cards.map((c, i) => (
                  <div key={c.id} style={{ marginLeft: i ? 'calc(var(--card-w) * -0.45)' : 0 }}>
                    <PlayingCard card={c} dealt={false} />
                  </div>
                ))}
              </motion.div>
            </AnimatePresence>
            <span className="rounded-full bg-black/55 px-3 py-0.5 text-sm font-semibold ring-1 ring-white/15">
              {strategyLabel(current.cards)}
            </span>
          </div>
        </div>

        <div role="group" aria-label="Your play" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {MOVES.map((m) => (
            <Button key={m.move} size="lg" className="min-w-0 px-2" shortcut={m.key} disabled={!current.available.includes(m.move)} onClick={() => { submit(m.move); }}>
              {m.label}
            </Button>
          ))}
        </div>

        <div aria-live="polite" className="min-h-24">
          {last && (
            <motion.div
              key={stats.attempts}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl p-4 ring-1 ${last.correct ? 'bg-good/10 ring-good/30' : 'bg-bad/10 ring-bad/40'}`}
            >
              <p className="font-semibold">
                <span aria-hidden>{last.correct ? '✓ ' : '✗ '}</span>
                {strategyLabel(last.hand.cards)} vs {describeTotal([last.hand.upcard])}:{' '}
                {last.correct ? (
                  <>{MOVE_NAME[last.answer]} is right.</>
                ) : (
                  <>
                    {MOVE_NAME[last.expected.move]}, not {MOVE_NAME[last.answer].toLowerCase()}.
                  </>
                )}
              </p>
              <table className="tabular mt-2 text-sm text-ink-2">
                <caption className="sr-only">Expected value of each play, per unit bet</caption>
                <tbody>
                  {last.evs.map((e) => (
                    <tr key={e.move} className={e.move === last.answer ? 'text-ink' : ''}>
                      <th scope="row" className="pr-4 text-left font-medium">
                        {MOVE_NAME[e.move]}
                        {e.move === last.expected.move && <span className="ml-1 text-good">★</span>}
                      </th>
                      <td className="text-right">{e.ev >= 0 ? '+' : '−'}{Math.abs(e.ev).toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!last.correct && last.cost > 0 && (
                <p className="mt-2 text-sm text-ink-3">That costs {percent(last.cost, 2)} of your bet in expected value.</p>
              )}
            </motion.div>
          )}
        </div>
      </section>

      <aside className="flex flex-col gap-5">
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Accuracy" value={stats.attempts ? percent(accuracy(stats), 0) : '—'} detail={`${stats.correct} of ${stats.attempts}`} />
          <StatTile label="Streak" value={stats.streak} detail={`Best ${stats.bestStreak}`} />
          <StatTile label="EV given up" value={stats.attempts ? percent(stats.evLost / stats.attempts, 2) : '—'} detail="per hand" />
        </div>

        <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm text-ink-2">
              Table
              <select
                value={presetId}
                onChange={(e) => { setPreset(e.target.value as PresetId); }}
                className="rounded-lg bg-black/30 px-2 py-1 text-ink ring-1 ring-white/15"
              >
                {Object.entries(RULE_PRESETS).map(([id, r]) => (
                  <option key={id} value={id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <Segmented
              label="Chart"
              value={chartTab}
              options={[
                { value: 'hard', label: 'Hard' },
                { value: 'soft', label: 'Soft' },
                { value: 'pairs', label: 'Pairs' },
              ]}
              onChange={setChartTab}
            />
          </div>
          <StrategyChart rules={rules} table={chartTab} highlight={last?.hand.cell ?? null} />
          <div className="mt-3">
            <ChartLegend rules={rules} />
          </div>
        </div>

        <Button variant="ghost" size="sm" className="self-start" onClick={resetStats}>
          Reset drill stats
        </Button>
      </aside>
    </div>
  );
}
