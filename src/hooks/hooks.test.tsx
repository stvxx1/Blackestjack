// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHotkeys } from './useHotkeys';
import { useStagedReveal } from './useStagedReveal';

describe('useStagedReveal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reveals new cards one step at a time while active', () => {
    const { result, rerender } = renderHook(({ total, active, round }) => useStagedReveal(total, active, 500, round), {
      initialProps: { total: 2, active: false, round: 1 },
    });
    expect(result.current).toBe(2);
    rerender({ total: 4, active: true, round: 1 });
    expect(result.current).toBe(2);
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toBe(3);
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toBe(4);
  });

  it('shows everything at once for a new round or when inactive', () => {
    const { result, rerender } = renderHook(({ total, active, round }) => useStagedReveal(total, active, 500, round), {
      initialProps: { total: 2, active: true, round: 1 },
    });
    rerender({ total: 5, active: true, round: 2 });
    expect(result.current).toBe(5);
    rerender({ total: 1, active: false, round: 2 });
    expect(result.current).toBe(1);
  });

  it('leaves no timers behind after unmount', () => {
    const { rerender, unmount } = renderHook(({ total }) => useStagedReveal(total, true, 500, 1), { initialProps: { total: 1 } });
    rerender({ total: 3 });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

function Keys({ onH }: { onH: () => void }) {
  useHotkeys({ h: onH });
  return <input aria-label="field" />;
}

describe('useHotkeys', () => {
  afterEach(cleanup);

  it('fires on the key, case-insensitively', () => {
    const onH = vi.fn();
    render(<Keys onH={onH} />);
    fireEvent.keyDown(window, { key: 'h' });
    fireEvent.keyDown(window, { key: 'H' });
    expect(onH).toHaveBeenCalledTimes(2);
  });

  it('ignores keys while typing or with modifiers held, and unbinds on unmount', () => {
    const onH = vi.fn();
    const { getByLabelText, unmount } = render(<Keys onH={onH} />);
    fireEvent.keyDown(getByLabelText('field'), { key: 'h' });
    fireEvent.keyDown(window, { key: 'h', ctrlKey: true });
    expect(onH).not.toHaveBeenCalled();
    unmount();
    fireEvent.keyDown(window, { key: 'h' });
    expect(onH).not.toHaveBeenCalled();
  });
});
