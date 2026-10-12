import { useStore } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { browserStorage } from '@/services/storage';

/** Presentation preferences. Kept apart from game settings so UI tweaks never touch game saves. */
export interface UiPrefs {
  readonly sound: boolean;
  readonly showCount: boolean;
  /** Ring the basic-strategy move on the action bar while playing. */
  readonly showHints: boolean;
  /** Milliseconds between dealt cards. */
  readonly dealSpeed: number;
  /** Milliseconds each card is shown in the running-count drill. */
  readonly flashSpeed: number;
}

export interface UiStoreState extends UiPrefs {
  readonly set: <K extends keyof UiPrefs>(key: K, value: UiPrefs[K]) => void;
}

export const DEFAULT_UI: UiPrefs = { sound: true, showCount: false, showHints: false, dealSpeed: 160, flashSpeed: 700 };

const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const inRange = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && v >= lo && v <= hi;

export function createUiStore(options: { readonly storage?: StateStorage } = {}): StoreApi<UiStoreState> {
  return createStore<UiStoreState>()(
    persist(
      (set) => ({
        ...DEFAULT_UI,
        set: (key, value) => {
          set({ [key]: value } as Partial<UiPrefs>);
        },
      }),
      {
        name: 'blackjackwiz:ui',
        version: 1,
        storage: createJSONStorage(() => options.storage ?? browserStorage()),
        partialize: ({ sound, showCount, showHints, dealSpeed, flashSpeed }) => ({ sound, showCount, showHints, dealSpeed, flashSpeed }),
        merge: (persisted, current) => {
          const p = (typeof persisted === 'object' && persisted !== null ? persisted : {}) as Record<string, unknown>;
          return {
            ...current,
            ...(isBool(p.sound) ? { sound: p.sound } : {}),
            ...(isBool(p.showCount) ? { showCount: p.showCount } : {}),
            ...(isBool(p.showHints) ? { showHints: p.showHints } : {}),
            ...(inRange(p.dealSpeed, 0, 1000) ? { dealSpeed: p.dealSpeed } : {}),
            ...(inRange(p.flashSpeed, 150, 3000) ? { flashSpeed: p.flashSpeed } : {}),
          };
        },
      },
    ),
  );
}

export const uiStore = createUiStore();

export function useUi<T>(selector: (state: UiStoreState) => T): T {
  return useStore(uiStore, selector);
}
