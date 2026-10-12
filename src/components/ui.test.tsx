// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/App';
import { gameStore } from '@/state/gameStore';
import { trainerStore } from '@/state/trainerStore';
import { countingStore } from '@/state/countingStore';

beforeEach(() => {
  localStorage.clear();
  gameStore.getState().resetBankroll(100_000);
  gameStore.getState().setBet(2_500);
  trainerStore.getState().resetStats();
  countingStore.getState().resetStats();
});
afterEach(cleanup);

const go = (route: string): void => {
  act(() => {
    window.location.hash = `#/${route}`;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
};

describe('table', () => {
  it('builds a bet from chips and deals with the keyboard', () => {
    go('table');
    render(<App />);
    expect(screen.getByLabelText(/Bankroll \$1,000/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add $100' }));
    expect(gameStore.getState().bet).toBe(12_500);
    fireEvent.keyDown(window, { key: 'Enter' });
    const { phase } = gameStore.getState().game;
    expect(['playerTurn', 'insurance', 'roundOver']).toContain(phase);
    if (phase === 'playerTurn') expect(screen.getByRole('group', { name: 'Your move' })).toBeTruthy();
  });

  it('shows a clear error under the table minimum', () => {
    go('table');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^Clear/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add $5' }));
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByRole('alert').textContent).toBe('Table minimum is $25. Add some chips.');
  });
});

describe('strategy trainer', () => {
  it('grades a click and shows the EV of every option', () => {
    go('trainer');
    render(<App />);
    const play = screen.getByRole('group', { name: 'Your play' });
    const stand = play.querySelector('button:not([disabled])');
    if (!stand) throw new Error('no enabled play');
    fireEvent.click(stand);
    expect(trainerStore.getState().stats.attempts).toBe(1);
    expect(screen.getByRole('table', { name: /Expected value/ })).toBeTruthy();
  });
});

describe('counting drills', () => {
  it('runs a true-count conversion end to end', () => {
    go('counting');
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'True count' }));
    fireEvent.click(screen.getByRole('button', { name: /^Start/ }));
    const drill = countingStore.getState().drill;
    if (drill?.kind !== 'trueCount') throw new Error('expected a true count drill');
    fireEvent.change(screen.getByLabelText('True count'), { target: { value: String(drill.answer) } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByRole('status').textContent).toMatch(/Correct/);
    expect(countingStore.getState().stats.trueCount.correct).toBe(1);
  });
});

describe('navigation', () => {
  it('renders every route with a heading or landmark and sets the title', () => {
    for (const [route, title] of [['stats', 'Stats'], ['settings', 'Settings'], ['trainer', 'Strategy trainer']] as const) {
      go(route);
      const { unmount } = render(<App />);
      expect(document.title).toBe(`${title} · BlackjackWiz`);
      expect(screen.getAllByRole('navigation', { name: 'Main' }).length).toBeGreaterThan(0);
      unmount();
    }
  });
});
