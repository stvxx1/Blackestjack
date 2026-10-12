import { useStore } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { createStore, type StoreApi } from 'zustand/vanilla';
import {
  createCountdownDrill,
  createDeviationDrill,
  createRunningCountDrill,
  createTrueCountDrill,
  gradeCountingDrill,
  HI_LO,
  isPresetId,
  randomSeed,
  RULE_PRESETS,
  seedRng,
  type CountingDrill,
  type CountingDrillKind,
  type PresetId,
  type RngState,
} from '@/engine';
import { browserStorage } from '@/services/storage';
import { countingSystem, isCountingSystemId, type CountingSystemId } from './count';

export interface DrillKindStats {
  readonly attempts: number;
  readonly correct: number;
  /** Fastest correct answer, ms. */
  readonly bestMs: number | null;
  readonly totalMs: number;
}

export interface DrillOutcome {
  readonly correct: boolean;
  readonly expected: CountingDrill['answer'];
  readonly given: number | string;
  readonly elapsedMs: number;
}

export interface CountingTrainerState {
  readonly system: CountingSystemId;
  readonly presetId: PresetId;
  /** Cards per running-count drill. */
  readonly runLength: number;
  readonly rng: RngState;
  readonly drill: CountingDrill | null;
  readonly lastOutcome: DrillOutcome | null;
  readonly stats: Readonly<Record<CountingDrillKind, DrillKindStats>>;

  readonly start: (kind: CountingDrillKind) => void;
  /** Grades the active drill. The UI measures `elapsedMs`; the store holds no timers. */
  readonly submit: (answer: number | string, elapsedMs: number) => void;
  readonly setSystem: (system: CountingSystemId) => void;
  readonly setPreset: (presetId: PresetId) => void;
  readonly setRunLength: (cards: number) => void;
  readonly resetStats: () => void;
}

const EMPTY_KIND: DrillKindStats = { attempts: 0, correct: 0, bestMs: null, totalMs: 0 };
const EMPTY_STATS: CountingTrainerState['stats'] = {
  running: EMPTY_KIND,
  trueCount: EMPTY_KIND,
  countdown: EMPTY_KIND,
  deviation: EMPTY_KIND,
};

export function createCountingStore(
  options: { readonly storage?: StateStorage; readonly seed?: number } = {},
): StoreApi<CountingTrainerState> {
  return createStore<CountingTrainerState>()(
    persist(
      (set, get) => ({
        system: 'hi-lo',
        presetId: 'au-casino',
        runLength: 20,
        rng: seedRng(options.seed ?? randomSeed()),
        drill: null,
        lastOutcome: null,
        stats: EMPTY_STATS,

        start: (kind) => {
          const { system, presetId, runLength, rng } = get();
          const sys = countingSystem(system);
          const rules = RULE_PRESETS[presetId];
          const r =
            kind === 'running'
              ? createRunningCountDrill(sys, rng, { cards: runLength })
              : kind === 'trueCount'
                ? createTrueCountDrill(rng, rules.decks)
                : kind === 'countdown'
                  ? createCountdownDrill(sys, rng)
                  : // Index plays are Hi-Lo numbers whatever system you count with.
                    createDeviationDrill(HI_LO, rules, rng);
          set({ drill: r.drill, rng: r.rng, lastOutcome: null });
        },

        submit: (answer, elapsedMs) => {
          const { drill, stats } = get();
          if (!drill) return;
          const correct = gradeCountingDrill(drill, answer);
          const prev = stats[drill.kind];
          const ms = Math.max(0, Math.round(elapsedMs));
          set({
            drill: null,
            lastOutcome: { correct, expected: drill.answer, given: answer, elapsedMs: ms },
            stats: {
              ...stats,
              [drill.kind]: {
                attempts: prev.attempts + 1,
                correct: prev.correct + (correct ? 1 : 0),
                bestMs: correct && (prev.bestMs === null || ms < prev.bestMs) ? ms : prev.bestMs,
                totalMs: prev.totalMs + ms,
              },
            },
          });
        },

        setSystem: (system) => {
          set({ system, drill: null, lastOutcome: null });
        },
        setPreset: (presetId) => {
          set({ presetId, drill: null, lastOutcome: null });
        },
        setRunLength: (cards) => {
          set({ runLength: Math.max(5, Math.min(312, Math.round(cards))) });
        },
        resetStats: () => {
          set({ stats: EMPTY_STATS, lastOutcome: null });
        },
      }),
      {
        name: 'blackjackwiz:counting-trainer',
        version: 1,
        storage: createJSONStorage(() => options.storage ?? browserStorage()),
        partialize: (s) => ({ system: s.system, presetId: s.presetId, runLength: s.runLength, stats: s.stats }),
        migrate: (persisted, version) => (version === 1 ? persisted : {}) as Partial<CountingTrainerState>,
        merge: (persisted, current) => {
          const p = (typeof persisted === 'object' && persisted !== null ? persisted : {}) as Record<string, unknown>;
          const stats = p.stats as Partial<Record<CountingDrillKind, DrillKindStats>> | undefined;
          return {
            ...current,
            ...(isCountingSystemId(p.system) ? { system: p.system } : {}),
            ...(isPresetId(p.presetId) ? { presetId: p.presetId } : {}),
            ...(Number.isInteger(p.runLength) ? { runLength: p.runLength as number } : {}),
            ...(stats && typeof stats === 'object' ? { stats: { ...EMPTY_STATS, ...stats } } : {}),
          };
        },
      },
    ),
  );
}

export const countingStore = createCountingStore();

export function useCountingStore<T>(selector: (state: CountingTrainerState) => T): T {
  return useStore(countingStore, selector);
}
