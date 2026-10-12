import { describe, expect, it } from 'vitest';
import { AU_CASINO, stackedShoe, VEGAS_STRIP, type GameState } from '@/engine';
import { cards } from '@/engine/test-utils';
import { memoryStorage } from '@/services/storage';
import { countInfo, countingSystem, unseenComposition } from './count';
import { createGameStore, DEFAULT_SETTINGS } from './gameStore';

const PERSIST_KEY = 'blackjackwiz:game';

function storeWithShoe(ranks: Parameters<typeof cards>, patch: Partial<GameState> = {}) {
  const storage = memoryStorage();
  const store = createGameStore({ storage, seed: 1, now: () => 42 });
  const { game } = store.getState();
  store.setState({ game: { ...game, shoe: stackedShoe(cards(...ranks)), ...patch } });
  return { store, storage };
}

describe('game store', () => {
  it('starts on the Australian table with the default bankroll', () => {
    const store = createGameStore({ storage: memoryStorage(), seed: 1 });
    const s = store.getState();
    expect(s.settings).toEqual(DEFAULT_SETTINGS);
    expect(s.game.rules).toBe(AU_CASINO);
    expect(s.game.bankroll).toBe(100_000);
    expect(s.bet).toBe(AU_CASINO.minBet);
  });

  it('clamps bets to the table and the bankroll', () => {
    const store = createGameStore({ storage: memoryStorage(), seed: 1 });
    store.getState().setBet(-5);
    expect(store.getState().bet).toBe(0);
    store.getState().setBet(10_000_000);
    expect(store.getState().bet).toBe(100_000);
  });

  it('enforces the table minimum at the deal', () => {
    const store = createGameStore({ storage: memoryStorage(), seed: 1 });
    store.getState().setBet(1_000);
    store.getState().deal();
    expect(store.getState().error).toBe('Table minimum is $25. Add some chips.');
    expect(store.getState().game.phase).toBe('betting');
  });

  it('plays a round and records it', () => {
    // ENHC deal order: player, dealer, player; then the dealer's hole card.
    const { store } = storeWithShoe(['10', '9', '10', '8']);
    store.getState().deal();
    expect(store.getState().game.phase).toBe('playerTurn');
    store.getState().act('stand');
    const s = store.getState();
    expect(s.game.phase).toBe('roundOver');
    expect(s.stats).toMatchObject({ rounds: 1, wins: 1, net: 2_500, decisions: 1, mistakes: 0 });
    expect(s.feedback).toMatchObject({ chose: 'stand', correct: 'stand', isCorrect: true, evLost: 0 });
  });

  it('grades a mistake, prices it in cents and logs it', () => {
    // 11 v 6: double is right; standing is a big mistake.
    const { store } = storeWithShoe(['6', '6', '5', '10', '10']);
    store.getState().deal();
    store.getState().act('stand');
    const s = store.getState();
    expect(s.feedback).toMatchObject({ chose: 'stand', correct: 'double', isCorrect: false });
    expect(s.feedback?.evLost).toBeGreaterThan(1_000);
    expect(s.stats.mistakes).toBe(1);
    expect(s.mistakes[0]).toMatchObject({ round: 1, at: 42, chose: 'stand', correct: 'double', upcard: '6♥' });
  });

  it('turns illegal actions into an error message instead of throwing', () => {
    const { store } = storeWithShoe(['10', '9', '10', '8']);
    store.getState().act('hit');
    expect(store.getState().error).toMatch(/cannot hit/);
    store.getState().clearError();
    expect(store.getState().error).toBeNull();
  });

  it('refuses to deal when the bankroll is below the minimum', () => {
    const { store } = storeWithShoe(['10', '9', '10', '8'], { bankroll: 100 });
    store.getState().deal();
    expect(store.getState().error).toMatch(/Reset/);
    store.getState().resetBankroll(50_000);
    expect(store.getState().game.bankroll).toBe(50_000);
    expect(store.getState().stats.peakBankroll).toBe(50_000);
  });

  it('grades insurance: never without a count, at +3 with Hi-Lo deviations on', () => {
    const peek = { ...VEGAS_STRIP };
    const { store } = storeWithShoe(['10', 'A', '9', '7', '5'], { rules: peek });
    store.getState().deal();
    expect(store.getState().game.phase).toBe('insurance');
    store.getState().insurance(true);
    expect(store.getState().feedback).toMatchObject({ chose: 'insure', correct: 'decline', isCorrect: false });
    expect(store.getState().feedback?.evLost).toBeGreaterThan(0);
  });

  it('expects insurance at a Hi-Lo true count of +3 when deviations are on', () => {
    // Visible 5, A, 6 = running +1. The stacked shoe is tiny, so decks remaining floors
    // at a quarter deck and the true count is +4.
    const { store } = storeWithShoe(['5', 'A', '6', '7', '5'], { rules: VEGAS_STRIP });
    store.getState().updateSettings({ useDeviations: true });
    store.getState().deal();
    store.getState().insurance(true);
    expect(store.getState().feedback).toMatchObject({ chose: 'insure', correct: 'insure', isCorrect: true, deviation: 'Insurance v A' });
  });

  it('changes tables between rounds only', () => {
    const { store } = storeWithShoe(['10', '9', '10', '8']);
    store.getState().deal();
    store.getState().updateSettings({ presetId: 'vegas-strip' });
    expect(store.getState().error).toMatch(/Finish/);
    store.getState().act('stand');
    store.getState().updateSettings({ presetId: 'vegas-strip' });
    const s = store.getState();
    expect(s.settings.presetId).toBe('vegas-strip');
    expect(s.game.rules).toBe(VEGAS_STRIP);
    expect(s.game.bankroll).toBe(102_500);
  });

  it('persists and restores a game mid-round', () => {
    const { store, storage } = storeWithShoe(['10', '9', '7', '8', '2']);
    store.getState().deal();
    store.getState().updateSettings({ useDeviations: true });
    const restored = createGameStore({ storage, seed: 99 }).getState();
    expect(restored.game).toEqual(store.getState().game);
    expect(restored.settings.useDeviations).toBe(true);
    restored.act('hit');
  });

  it('drops corrupt persisted fields but keeps the good ones', () => {
    const storage = memoryStorage({
      [PERSIST_KEY]: JSON.stringify({
        version: 1,
        state: { game: { phase: 'nonsense' }, settings: { ...DEFAULT_SETTINGS, presetId: 'vegas-strip' }, bet: -5, stats: null, mistakes: [] },
      }),
    });
    const s = createGameStore({ storage, seed: 1 }).getState();
    expect(s.game.phase).toBe('betting');
    expect(s.settings.presetId).toBe('vegas-strip');
    expect(s.bet).toBe(AU_CASINO.minBet);
  });

  it('ignores persisted data from an unknown version', () => {
    const storage = memoryStorage({ [PERSIST_KEY]: JSON.stringify({ version: 99, state: { bet: 7_500 } }) });
    expect(createGameStore({ storage, seed: 1 }).getState().bet).toBe(AU_CASINO.minBet);
  });
});

describe('count helpers', () => {
  it('counts only what the player can see', () => {
    const { store } = storeWithShoe(['5', '6', '4', 'K', '2'], { rules: VEGAS_STRIP });
    store.getState().deal();
    const { game } = store.getState();
    // 5, 6, 4 visible (+3); K is the hole card.
    const info = countInfo(game, countingSystem('hi-lo'));
    expect(info.running).toBe(3);
    expect(info.cardsSeen).toBe(3);
    expect(countInfo(game, countingSystem('ko')).trueCount).toBeNull();
    const comp = unseenComposition(game);
    expect(comp[4]).toBe(VEGAS_STRIP.decks * 4 - 1);
    expect(comp[9]).toBe(VEGAS_STRIP.decks * 16);
  });
});
