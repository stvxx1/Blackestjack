import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { COUNTING_SYSTEMS, RULE_PRESETS, type CountingDrillKind, type PlayerMove, type PresetId } from '@/engine';
import { Button } from '@/components/atoms/Button';
import { PlayingCard } from '@/components/atoms/PlayingCard';
import { Segmented } from '@/components/atoms/Segmented';
import { StatTile } from '@/components/atoms/StatTile';
import { useHotkeys } from '@/hooks/useHotkeys';
import { strategyLabel } from '@/lib/cards';
import { percent, signed } from '@/lib/format';
import { countingStore, useCountingStore, type DrillKindStats } from '@/state/countingStore';
import type { CountdownDrill as CountdownDrillData, RunningCountDrill } from '@/engine';
import type { CountingSystemId } from '@/state/count';
import { uiStore, useUi } from '@/state/uiStore';
import { playSound } from '@/services/sound';

const KINDS: readonly { value: CountingDrillKind; label: string; blurb: string }[] = [
  { value: 'running', label: 'Running count', blurb: 'Cards flash one at a time. Keep the running count and enter it at the end.' },
  { value: 'trueCount', label: 'True count', blurb: 'Convert a running count to a true count: divide by decks remaining and round down.' },
  { value: 'countdown', label: 'Deck countdown', blurb: 'Count through a deck with one card missing as fast as you can. Space or tap to advance.' },
  { value: 'deviation', label: 'Index plays', blurb: 'Hi-Lo Illustrious 18 and Fab 4: play the hand correctly for the true count shown.' },
];

const now = (): number => performance.now();

export function CountingDrills() {
  const [kind, setKind] = useState<CountingDrillKind>('running');
  const { system, presetId, stats } = useCountingStore((s) => s);
  const { setSystem, setPreset } = countingStore.getState();
  const info = KINDS.find((k) => k.value === kind);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl text-brass-200">Counting drills</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<CountingSystemId>
            label="Counting system"
            value={system}
            options={COUNTING_SYSTEMS.map((s) => ({ value: s.id, label: s.name.replace(' (KO)', '') }))}
            onChange={setSystem}
          />
          <select
            aria-label="Table rules"
            value={presetId}
            onChange={(e) => { setPreset(e.target.value as PresetId); }}
            className="h-10 rounded-xl bg-black/30 px-2 text-sm ring-1 ring-white/15"
          >
            {Object.entries(RULE_PRESETS).map(([id, r]) => (
              <option key={id} value={id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div role="tablist" aria-label="Drill" className="flex gap-1 overflow-x-auto rounded-2xl bg-black/25 p-1 ring-1 ring-white/10">
        {KINDS.map((k) => (
          <button
            key={k.value}
            role="tab"
            type="button"
            aria-selected={k.value === kind}
            onClick={() => { setKind(k.value); }}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              k.value === kind ? 'bg-brass-400 text-felt-950' : 'text-ink-2 hover:bg-white/8 hover:text-ink'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      <p className="text-sm text-ink-2">{info?.blurb}</p>

      <DrillStats stats={stats[kind]} />

      <div role="tabpanel" className="felt min-h-[22rem] rounded-3xl p-5 shadow-[inset_0_0_60px_rgb(0_0_0/0.5)] sm:p-8">
        {kind === 'running' && <RunningDrill />}
        {kind === 'trueCount' && <TrueCountDrill />}
        {kind === 'countdown' && <CountdownDrill />}
        {kind === 'deviation' && <DeviationDrill />}
      </div>
    </div>
  );
}

function DrillStats({ stats }: { stats: DrillKindStats }) {
  const avg = stats.attempts ? stats.totalMs / stats.attempts / 1000 : 0;
  return (
    <div className="grid grid-cols-3 gap-3">
      <StatTile label="Accuracy" value={stats.attempts ? percent(stats.correct / stats.attempts, 0) : '—'} detail={`${stats.correct} of ${stats.attempts}`} />
      <StatTile label="Best time" value={stats.bestMs === null ? '—' : `${(stats.bestMs / 1000).toFixed(1)}s`} detail="correct answers only" />
      <StatTile label="Average time" value={stats.attempts ? `${avg.toFixed(1)}s` : '—'} />
    </div>
  );
}

/** Feedback after an answer: right/wrong, the expected answer, the time. */
function Outcome() {
  const outcome = useCountingStore((s) => s.lastOutcome);
  if (!outcome) return null;
  const show = (v: number | string): string => (typeof v === 'number' ? signed(v) : v);
  return (
    <motion.p
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      role="status"
      className={`rounded-xl px-4 py-2 text-center font-semibold ring-1 ${
        outcome.correct ? 'bg-good/15 text-good ring-good/40' : 'bg-bad/15 text-[#ffb3ad] ring-bad/40'
      }`}
    >
      <span aria-hidden>{outcome.correct ? '✓ ' : '✗ '}</span>
      {outcome.correct ? 'Correct' : `Answer: ${show(outcome.expected)} (you said ${show(outcome.given)})`}
      <span className="ml-2 font-normal text-ink-2">{(outcome.elapsedMs / 1000).toFixed(1)}s</span>
    </motion.p>
  );
}

/** Integer entry with a ± button, since phone number pads often lack a minus key. */
function CountAnswer({ label, onSubmit }: { label: string; onSubmit: (n: number) => void }) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  const submit = (e: { preventDefault: () => void }): void => {
    e.preventDefault();
    const n = Number.parseInt(value.replace('−', '-'), 10);
    if (Number.isNaN(n)) return;
    onSubmit(n);
  };
  return (
    <form onSubmit={submit} className="flex items-center justify-center gap-2">
      <label className="sr-only" htmlFor="count-answer">
        {label}
      </label>
      <Button
        aria-label="Toggle sign"
        onClick={() => {
          setValue((v) => (v.startsWith('-') ? v.slice(1) : `-${v}`));
          ref.current?.focus();
        }}
      >
        ±
      </Button>
      <input
        ref={ref}
        id="count-answer"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(e) => { setValue(e.target.value.replace(/[^\d-]/g, '')); }}
        placeholder="0"
        className="tabular h-12 w-28 rounded-xl bg-black/40 text-center text-2xl font-semibold ring-1 ring-white/20 focus:ring-brass-300"
      />
      <Button type="submit" variant="primary" size="lg">
        Check
      </Button>
    </form>
  );
}

function StartButton({ kind, label = 'Start' }: { kind: CountingDrillKind; label?: string }) {
  return (
    <Button
      variant="primary"
      size="lg"
      shortcut="↵"
      onClick={() => {
        countingStore.getState().start(kind);
      }}
    >
      {label}
    </Button>
  );
}

function useSubmit(startedAt: React.RefObject<number>) {
  return (answer: number | string): void => {
    countingStore.getState().submit(answer, now() - startedAt.current);
    const outcome = countingStore.getState().lastOutcome;
    if (uiStore.getState().sound) playSound(outcome?.correct ? 'win' : 'lose');
  };
}

function RunningDrill() {
  const drill = useCountingStore((s) => s.drill);
  const runLength = useCountingStore((s) => s.runLength);
  const attempts = useCountingStore((s) => s.stats.running.attempts);
  const flashSpeed = useUi((s) => s.flashSpeed);
  const active = drill?.kind === 'running' ? drill : null;
  useHotkeys({ Enter: () => { countingStore.getState().start('running'); } }, !active);

  // Keyed per attempt so each run starts from a fresh card index.
  if (active) return <RunningSession key={attempts} drill={active} flashSpeed={flashSpeed} />;
  return (
    <div className="flex flex-col items-center gap-5">
      <Outcome />
      <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-ink-2">
        <label className="flex items-center gap-2">
          Cards
          <select
            value={runLength}
            onChange={(e) => { countingStore.getState().setRunLength(Number(e.target.value)); }}
            className="rounded-lg bg-black/30 px-2 py-1 text-ink ring-1 ring-white/15"
          >
            {[10, 20, 30, 52].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Speed
          <input
            type="range"
            min={200}
            max={1500}
            step={50}
            value={1700 - flashSpeed}
            onChange={(e) => { uiStore.getState().set('flashSpeed', 1700 - Number(e.target.value)); }}
            className="accent-brass-400"
            aria-valuetext={`${(flashSpeed / 1000).toFixed(2)} seconds per card`}
          />
          <span className="tabular w-14">{(flashSpeed / 1000).toFixed(2)}s</span>
        </label>
      </div>
      <StartButton kind="running" />
    </div>
  );
}

function RunningSession({ drill, flashSpeed }: { drill: RunningCountDrill; flashSpeed: number }) {
  const [index, setIndex] = useState(0);
  const startedAt = useRef(now());
  const submit = useSubmit(startedAt);

  const done = index >= drill.cards.length;
  // One timeout per card, so nothing keeps ticking once the run is over.
  useEffect(() => {
    if (done) return undefined;
    const id = window.setTimeout(() => {
      setIndex((i) => i + 1);
    }, flashSpeed);
    return () => {
      window.clearTimeout(id);
    };
  }, [index, done, flashSpeed]);

  const card = drill.cards[index];
  if (done) {
    return (
      <div className="flex flex-col items-center gap-5">
        <p className="text-ink-2">What's the running count?</p>
        <CountAnswer label="Running count" onSubmit={submit} />
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-5">
      <span className="tabular text-sm text-ink-3">
        {index + 1} / {drill.cards.length}
      </span>
      <div className="flex h-[calc(var(--card-h)*1.35)] items-center">
        <AnimatePresence mode="popLayout">
          {card && (
            <motion.div key={card.id} initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -40, opacity: 0 }} transition={{ duration: 0.12 }}>
              <PlayingCard card={card} size="lg" dealt={false} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function TrueCountDrill() {
  const drill = useCountingStore((s) => s.drill);
  const active = drill?.kind === 'trueCount' ? drill : null;
  const startedAt = useRef(0);
  const submit = useSubmit(startedAt);
  useEffect(() => {
    if (active) startedAt.current = now();
  }, [active]);
  useHotkeys({ Enter: () => { countingStore.getState().start('trueCount'); } }, !active);

  if (!active) {
    return (
      <div className="flex flex-col items-center gap-5">
        <Outcome />
        <StartButton kind="trueCount" />
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-6">
      <dl className="tabular grid grid-cols-2 gap-6 text-center">
        <div>
          <dt className="text-xs tracking-widest text-ink-3 uppercase">Running count</dt>
          <dd className="text-5xl font-semibold">{signed(active.runningCount)}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-widest text-ink-3 uppercase">Decks remaining</dt>
          <dd className="text-5xl font-semibold">{active.decksRemaining}</dd>
        </div>
      </dl>
      <CountAnswer label="True count" onSubmit={submit} />
      <p className="text-xs text-ink-3">Round toward negative infinity: −2.5 becomes −3.</p>
    </div>
  );
}

function CountdownDrill() {
  const drill = useCountingStore((s) => s.drill);
  const attempts = useCountingStore((s) => s.stats.countdown.attempts);
  const active = drill?.kind === 'countdown' ? drill : null;
  useHotkeys({ Enter: () => { countingStore.getState().start('countdown'); } }, !active);

  if (active) return <CountdownSession key={attempts} drill={active} />;
  return (
    <div className="flex flex-col items-center gap-5">
      <Outcome />
      <StartButton kind="countdown" label="Start countdown" />
    </div>
  );
}

function CountdownSession({ drill }: { drill: CountdownDrillData }) {
  const [index, setIndex] = useState(0);
  const startedAt = useRef(now());
  const submit = useSubmit(startedAt);
  const done = index >= drill.cards.length;
  const next = (): void => {
    setIndex((i) => Math.min(i + 1, drill.cards.length));
  };
  useHotkeys({ ' ': next, ArrowRight: next }, !done);

  if (done) {
    return (
      <div className="flex flex-col items-center gap-5">
        <p className="text-ink-2">Final running count?</p>
        <CountAnswer label="Final running count" onSubmit={submit} />
      </div>
    );
  }
  const card = drill.cards[index];
  return (
    <div className="flex flex-col items-center gap-4">
      <span className="tabular text-sm text-ink-3">
        {index + 1} / {drill.cards.length}
      </span>
      <button type="button" onClick={next} aria-label="Next card" className="rounded-xl">
        {card && <PlayingCard key={card.id} card={card} size="lg" dealt={false} />}
      </button>
      <p className="text-xs text-ink-3 max-sm:hidden">Space or → for the next card</p>
    </div>
  );
}

const DEVIATION_ANSWERS: readonly { value: PlayerMove; label: string; key: string }[] = [
  { value: 'hit', label: 'Hit', key: 'H' },
  { value: 'stand', label: 'Stand', key: 'S' },
  { value: 'double', label: 'Double', key: 'D' },
  { value: 'split', label: 'Split', key: 'P' },
  { value: 'surrender', label: 'Surrender', key: 'R' },
];

function DeviationDrill() {
  const drill = useCountingStore((s) => s.drill);
  const last = useCountingStore((s) => s.lastOutcome);
  const active = drill?.kind === 'deviation' ? drill : null;
  const startedAt = useRef(0);
  const submit = useSubmit(startedAt);
  useEffect(() => {
    if (active) startedAt.current = now();
  }, [active]);

  const insurance = active?.play.kind === 'insurance';
  const answer = (a: string): void => {
    if (active) submit(a);
  };
  useHotkeys(
    insurance
      ? { y: () => { answer('insure'); }, n: () => { answer('decline'); } }
      : Object.fromEntries(DEVIATION_ANSWERS.map((a) => [a.key.toLowerCase(), () => { if (active?.available.includes(a.value)) answer(a.value); }])),
    active !== null,
  );
  useHotkeys({ Enter: () => { countingStore.getState().start('deviation'); } }, !active);

  if (!active) {
    return (
      <div className="flex flex-col items-center gap-5">
        <Outcome />
        {last && <p className="text-sm text-ink-3">Next hand straddles another index.</p>}
        <StartButton kind="deviation" label={last ? 'Next hand' : 'Start'} />
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-5">
      <span className="tabular rounded-full bg-brass-400 px-4 py-1 text-lg font-bold text-felt-950">True count {signed(active.trueCount)}</span>
      <div className="flex items-end gap-8">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs tracking-widest text-ink-3 uppercase">Dealer</span>
          <PlayingCard card={active.upcard} dealt={false} />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs tracking-widest text-ink-3 uppercase">{insurance ? 'Insurance?' : strategyLabel(active.cards)}</span>
          <div className="flex">
            {active.cards.map((c, i) => (
              <div key={c.id} style={{ marginLeft: i ? 'calc(var(--card-w) * -0.45)' : 0 }}>
                <PlayingCard card={c} dealt={false} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div role="group" aria-label="Your play" className="flex flex-wrap justify-center gap-2">
        {insurance ? (
          <>
            <Button variant="primary" shortcut="Y" onClick={() => { answer('insure'); }}>
              Insure
            </Button>
            <Button shortcut="N" onClick={() => { answer('decline'); }}>
              Decline
            </Button>
          </>
        ) : (
          DEVIATION_ANSWERS.filter((a) => active.available.includes(a.value)).map((a) => (
            <Button key={a.value} shortcut={a.key} onClick={() => { answer(a.value); }}>
              {a.label}
            </Button>
          ))
        )}
      </div>
    </div>
  );
}
