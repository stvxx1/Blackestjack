import { useEffect, useRef } from 'react';

export type HotkeyMap = Readonly<Record<string, (event: KeyboardEvent) => void>>;

const isTyping = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
};

/**
 * Global single-key shortcuts (`h`, `Enter`, ` `). Ignored while typing in a field or with
 * Ctrl/Cmd/Alt held, so browser shortcuts keep working. The latest map is read through a
 * ref, so callers can pass a fresh object every render without re-binding listeners.
 */
export function useHotkeys(map: HotkeyMap, enabled = true): void {
  const ref = useRef(map);
  useEffect(() => {
    ref.current = map;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || isTyping(e.target)) return;
      const handler = ref.current[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (!handler) return;
      // Space and Enter would otherwise also "click" the focused button.
      e.preventDefault();
      handler(e);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [enabled]);
}
