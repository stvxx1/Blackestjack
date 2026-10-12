import { useStore } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { createStore, type StoreApi } from 'zustand/vanilla';
import {
  EMPTY_DRILL_STATS,
  generateDrillHand,
  gradeDrill,
  isPresetId,
  randomSeed,
  recordDrill,
  RULE_PRESETS,
  seedRng,
  type DrillCategory,
  type DrillGrade,
  type DrillHand,
  type DrillStats,
  type PlayerMove,
  type PresetId,
  type RngState,
} from '@/engine';
import { browserStorage } from '@/services/storage';

export interface GradedDrill extends DrillGrade {
  readonly hand: DrillHand;
}

export interface StrategyTrainerState {
  readonly presetId: PresetId;
  readonly category: DrillCategory;
  readonly rng: RngState;
  readonly current: DrillHand;
  /** The previous hand and how it was graded, for the feedback panel. */
  readonly last: GradedDrill | null;
  readonly stats: DrillStats;

  answer(move: PlayerMove): void;
  setCategory(category: DrillCategory): void;
  setPreset(presetId: PresetId): void;
  resetStats(): void;
}

const CATEGORIES = new Set<DrillCategory>(['all', 'hard', 'soft', 'pairs']);

export function createTrainerStore(
  options: { readonly storage?: StateStorage; readonly seed?: number } = {},
): StoreApi<StrategyTrainerState> {
  const first = generateDrillHand(RULE_PRESETS['au-casino'], 'all', seedRng(options.seed ?? randomSeed()));

  return createStore<StrategyTrainerState>()(
    persist(
      (set, get) => {
        const deal = (patch: Partial<StrategyTrainerState> = {}): Partial<StrategyTrainerState> => {
          const s = { ...get(), ...patch };
          const r = generateDrillHand(RULE_PRESETS[s.presetId], s.category, s.rng, s.stats);
          return { ...patch, current: r.hand, rng: r.rng };
        };

        return {
          presetId: 'au-casino',
          category: 'all',
          rng: first.rng,
          current: first.hand,
          last: null,
          stats: EMPTY_DRILL_STATS,

          answer: (move) => {
            const { current, presetId, stats } = get();
            if (!current.available.includes(move)) return;
            const graded = gradeDrill(RULE_PRESETS[presetId], current, move);
            set(deal({ last: { ...graded, hand: current }, stats: recordDrill(stats, current.cell, graded) }));
          },

          setCategory: (category) => {
            set(deal({ category, last: null }));
          },

          setPreset: (presetId) => {
            set(deal({ presetId, last: null }));
          },

          resetStats: () => {
            set(deal({ stats: EMPTY_DRILL_STATS, last: null }));
          },
        };
      },
      {
        name: 'blackjackwiz:strategy-trainer',
        version: 1,
        storage: createJSONStorage(() => options.storage ?? browserStorage()),
        partialize: (s) => ({ presetId: s.presetId, category: s.category, stats: s.stats }),
        migrate: (persisted, version) => (version === 1 ? persisted : {}) as Partial<StrategyTrainerState>,
        merge: (persisted, current) => {
          const p = (typeof persisted === 'object' && persisted !== null ? persisted : {}) as Record<string, unknown>;
          const merged: StrategyTrainerState = {
            ...current,
            ...(isPresetId(p.presetId) ? { presetId: p.presetId } : {}),
            ...(CATEGORIES.has(p.category as DrillCategory) ? { category: p.category as DrillCategory } : {}),
            ...(isDrillStats(p.stats) ? { stats: p.stats } : {}),
          };
          // Re-deal so the first hand matches the restored table and category.
          const r = generateDrillHand(RULE_PRESETS[merged.presetId], merged.category, merged.rng, merged.stats);
          return { ...merged, current: r.hand, rng: r.rng };
        },
      },
    ),
  );
}

function isDrillStats(v: unknown): v is DrillStats {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return Number.isInteger(s.attempts) && Number.isInteger(s.correct) && typeof s.cells === 'object' && s.cells !== null;
}

export const trainerStore = createTrainerStore();

export function useTrainerStore<T>(selector: (state: StrategyTrainerState) => T): T {
  return useStore(trainerStore, selector);
}
