import type { StateStorage } from 'zustand/middleware';

/** In-memory storage: used in tests, SSR, and when the browser blocks localStorage. */
export function memoryStorage(initial: Record<string, string> = {}): StateStorage & { dump(): Record<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
    dump: () => Object.fromEntries(data),
  };
}

/**
 * localStorage when it actually works (private mode and some embedded browsers throw on
 * write, and quota can run out), otherwise memory. Writes never throw into the app.
 */
export function browserStorage(): StateStorage {
  const fallback = memoryStorage();
  let ls: Storage | null = null;
  try {
    const probe = '__bjw_probe__';
    globalThis.localStorage.setItem(probe, probe);
    globalThis.localStorage.removeItem(probe);
    ls = globalThis.localStorage;
  } catch {
    return fallback;
  }
  return {
    getItem: (key) => {
      try {
        return ls.getItem(key);
      } catch {
        return fallback.getItem(key);
      }
    },
    setItem: (key, value) => {
      try {
        ls.setItem(key, value);
      } catch {
        void fallback.setItem(key, value);
      }
    },
    removeItem: (key) => {
      try {
        ls.removeItem(key);
      } catch {
        void fallback.removeItem(key);
      }
    },
  };
}
