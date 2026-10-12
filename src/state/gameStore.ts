import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { createStore, type StoreApi } from 'zustand/vanilla';
import {
  applyAction,
  cardLabel,
  createGame,
  currentHand,
  dealerUpcard,
  emptySessionStats,
  evaluateMoves,
  evCost,
  GameError,
  insuranceCost,
  isPresetId,
  legalMoves,
  logMistake,
  recommendPlay,
  recordDecision,
  recordRound,
  RULE_PRESETS,
  shouldInsure,
  validateRules,
  type GameAction,
  type GameState,
  type Mistake,
  type PlayerMove,
  type PresetId,
  type SessionStats,
} from '@/engine';
import { money } from '@/lib/format';
import { browserStorage } from '@/services/storage';
import { countInfo, countingSystem, isCountingSystemId, unseenComposition, type CountInfo, type CountingSystemId } from './count';

export interface GameSettings {
  readonly presetId: PresetId;
  readonly countingSystem: CountingSystemId;
  /** Grade every decision and show feedback. */
  readonly coach: boolean;
  /** Grade against Hi-Lo index plays at the live true count instead of pure basic strategy. */
  readonly useDeviations: boolean;
  /** Cents. */
  readonly startingBankroll: number;
}

type Decision = PlayerMove | 'insure' | 'decline';

export interface DecisionFeedback {
  readonly round: number;
  readonly chose: Decision;
  readonly correct: Decision;
  readonly isCorrect: boolean;
  /** Label of the index play that decided it, e.g. "16 v 10". */
  readonly deviation: string | null;
  /** Cents of expected value given up. */
  readonly evLost: number;
}

export interface GameStoreState {
  readonly game: GameState;
  readonly settings: GameSettings;
  /** Bet for the next deal, in cents. */
  readonly bet: number;
  readonly stats: SessionStats;
  readonly mistakes: readonly Mistake[];
  readonly feedback: DecisionFeedback | null;
  readonly error: string | null;

  readonly setBet: (cents: number) => void;
  readonly deal: () => void;
  readonly act: (move: PlayerMove) => void;
  readonly insurance: (take: boolean) => void;
  readonly resetBankroll: (cents?: number) => void;
  readonly updateSettings: (patch: Partial<GameSettings>) => void;
  readonly clearError: () => void;
}

export const DEFAULT_SETTINGS: GameSettings = {
  presetId: 'au-casino',
  countingSystem: 'hi-lo',
  coach: true,
  useDeviations: false,
  startingBankroll: 100_000,
};

export interface GameStoreOptions {
  readonly storage?: StateStorage;
  readonly seed?: number;
  readonly now?: () => number;
}

const PERSIST_KEY = 'blackjackwiz:game';
const PERSIST_VERSION = 1;

type Persisted = Pick<GameStoreState, 'game' | 'settings' | 'bet' | 'stats' | 'mistakes'>;

export function createGameStore(options: GameStoreOptions = {}): StoreApi<GameStoreState> {
  const now = options.now ?? Date.now;
  const newGame = (presetId: PresetId, bankroll: number): GameState =>
    createGame(RULE_PRESETS[presetId], {
      bankroll,
      ...(options.seed === undefined ? {} : { seed: options.seed }),
    });

  return createStore<GameStoreState>()(
    persist(
      (set, get) => {
        /** Runs an engine action, turning engine errors into a user-facing message. */
        const run = (action: GameAction): GameState | null => {
          try {
            return applyAction(get().game, action);
          } catch (e) {
            if (e instanceof GameError) {
              set({ error: e.message });
              return null;
            }
            throw e;
          }
        };

        const settleIfDone = (prev: GameState, next: GameState, stats: SessionStats): SessionStats =>
          prev.phase !== 'roundOver' && next.phase === 'roundOver' ? recordRound(stats, next) : stats;

        const grade = (
          chose: Decision,
          correct: Decision,
          deviation: string | null,
          trueCount: number | null,
          evLost: number,
        ): Pick<GameStoreState, 'feedback' | 'stats' | 'mistakes'> => {
          const { game, stats, mistakes } = get();
          const isCorrect = chose === correct;
          const feedback: DecisionFeedback = { round: game.round, chose, correct, isCorrect, deviation, evLost };
          const hand = currentHand(game) ?? game.hands[0];
          const up = dealerUpcard(game);
          return {
            feedback,
            stats: recordDecision(stats, !isCorrect, evLost),
            mistakes: isCorrect
              ? mistakes
              : logMistake(mistakes, {
                  round: game.round,
                  at: now(),
                  hand: (hand?.cards ?? []).map(cardLabel),
                  upcard: up ? cardLabel(up) : '',
                  chose,
                  correct,
                  deviation,
                  trueCount,
                  evLost,
                }),
          };
        };

        /** True count used for grading, or undefined when grading pure basic strategy. */
        const gradingTrueCount = (): number | undefined => {
          const { game, settings } = get();
          if (!settings.useDeviations || settings.countingSystem !== 'hi-lo') return undefined;
          return countInfo(game, countingSystem('hi-lo')).trueCount ?? undefined;
        };

        return {
          game: newGame(DEFAULT_SETTINGS.presetId, DEFAULT_SETTINGS.startingBankroll),
          settings: DEFAULT_SETTINGS,
          bet: RULE_PRESETS[DEFAULT_SETTINGS.presetId].minBet,
          stats: emptySessionStats(DEFAULT_SETTINGS.startingBankroll),
          mistakes: [],
          feedback: null,
          error: null,

          setBet: (cents) => {
            // Anything from nothing up to what the table and bankroll allow; the minimum
            // is enforced when dealing so chips can be stacked up from zero.
            const { rules, bankroll } = get().game;
            set({ bet: Math.max(0, Math.min(rules.maxBet, bankroll, Math.round(cents))), error: null });
          },

          deal: () => {
            const { game, bet, stats } = get();
            if (game.bankroll < game.rules.minBet) {
              set({ error: 'Bankroll is below the table minimum. Reset it to keep playing.' });
              return;
            }
            const wager = Math.min(bet, game.bankroll);
            if (wager < game.rules.minBet) {
              set({ error: `Table minimum is ${money(game.rules.minBet)}. Add some chips.` });
              return;
            }
            const next = run({ type: 'deal', bet: wager });
            if (next) set({ game: next, stats: settleIfDone(game, next, stats), feedback: null, error: null });
          },

          act: (move) => {
            const { game, settings } = get();
            const hand = currentHand(game);
            const up = dealerUpcard(game);
            let graded: Partial<GameStoreState> = {};
            if (settings.coach && hand && up && legalMoves(game).includes(move)) {
              const tc = gradingTrueCount();
              const available = legalMoves(game);
              const rec = recommendPlay({
                cards: hand.cards,
                dealerUpcard: up,
                rules: game.rules,
                available,
                ...(tc === undefined ? {} : { trueCount: tc }),
              });
              // Price mistakes against the shoe the player can actually see when counting.
              const composition = tc === undefined ? undefined : unseenComposition(game, [...hand.cards, up]);
              const evs = evaluateMoves({
                cards: hand.cards,
                dealerUpcard: up,
                rules: game.rules,
                available,
                ...(composition ? { composition } : {}),
              });
              const evLost = move === rec.move ? 0 : Math.round(evCost(evs, move) * hand.baseBet);
              graded = grade(move, rec.move, rec.deviation?.label ?? null, tc ?? null, evLost);
            }
            const next = run({ type: move });
            if (!next) return;
            const stats = graded.stats ?? get().stats;
            set({ ...graded, game: next, stats: settleIfDone(game, next, stats), error: null });
          },

          insurance: (take) => {
            const { game, settings } = get();
            let graded: Partial<GameStoreState> = {};
            if (settings.coach && game.phase === 'insurance') {
              const tc = gradingTrueCount();
              const insure = shouldInsure(countingSystem('hi-lo'), tc);
              // Insurance pays 2:1 on a ten in the hole: EV per unit = 3·P(ten) − 1.
              const comp = unseenComposition(game);
              const unseen = comp.reduce((a, b) => a + b, 0);
              const pTen = (comp[9] ?? 0) / unseen;
              const evPerUnit = 3 * pTen - 1;
              const evLost = take === insure ? 0 : Math.round(Math.abs(evPerUnit) * insuranceCost(game));
              graded = grade(take ? 'insure' : 'decline', insure ? 'insure' : 'decline', tc === undefined ? null : 'Insurance v A', tc ?? null, evLost);
            }
            const next = run({ type: 'insurance', take });
            if (!next) return;
            const stats = graded.stats ?? get().stats;
            set({ ...graded, game: next, stats: settleIfDone(game, next, stats), error: null });
          },

          resetBankroll: (cents) => {
            const { settings } = get();
            const bankroll = cents ?? settings.startingBankroll;
            set({
              game: newGame(settings.presetId, bankroll),
              stats: emptySessionStats(bankroll),
              bet: RULE_PRESETS[settings.presetId].minBet,
              feedback: null,
              error: null,
            });
          },

          updateSettings: (patch) => {
            const { settings, game, bet } = get();
            const next = { ...settings, ...patch };
            if (next.presetId !== settings.presetId) {
              if (game.phase !== 'betting' && game.phase !== 'roundOver') {
                set({ error: 'Finish the current round before changing tables.' });
                return;
              }
              const rules = RULE_PRESETS[next.presetId];
              set({
                settings: next,
                game: newGame(next.presetId, game.bankroll),
                bet: Math.max(rules.minBet, Math.min(rules.maxBet, bet)),
                feedback: null,
                error: null,
              });
              return;
            }
            set({ settings: next, error: null });
          },

          clearError: () => {
            set({ error: null });
          },
        };
      },
      {
        name: PERSIST_KEY,
        version: PERSIST_VERSION,
        storage: createJSONStorage(() => options.storage ?? browserStorage()),
        partialize: (s): Persisted => ({ game: s.game, settings: s.settings, bet: s.bet, stats: s.stats, mistakes: s.mistakes }),
        // Unknown future/past versions: start clean rather than load a shape we don't understand.
        migrate: (persisted, version) => (version === PERSIST_VERSION ? persisted : {}) as Persisted,
        merge: (persisted, current) => ({ ...current, ...sanitize(persisted) }),
      },
    ),
  );
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isCents = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;
const PHASES = new Set(['betting', 'insurance', 'playerTurn', 'roundOver']);

/**
 * Accept only well-formed persisted slices. Anything damaged (hand-edited storage, an old
 * build) is dropped piecemeal so one bad field doesn't wipe the rest.
 */
function sanitize(raw: unknown): Partial<Persisted> {
  if (!isRecord(raw)) return {};
  const out: { -readonly [K in keyof Persisted]?: Persisted[K] } = {};

  const s = raw.settings;
  if (
    isRecord(s) &&
    isPresetId(s.presetId) &&
    isCountingSystemId(s.countingSystem) &&
    typeof s.coach === 'boolean' &&
    typeof s.useDeviations === 'boolean' &&
    isCents(s.startingBankroll)
  ) {
    out.settings = s as unknown as GameSettings;
  }

  const g = raw.game;
  if (
    isRecord(g) &&
    typeof g.phase === 'string' &&
    PHASES.has(g.phase) &&
    isCents(g.bankroll) &&
    isRecord(g.shoe) &&
    Array.isArray(g.shoe.cards) &&
    Array.isArray(g.hands) &&
    Array.isArray(g.dealer) &&
    Array.isArray(g.rng) &&
    g.rng.length === 4 &&
    isRecord(g.rules)
  ) {
    try {
      validateRules(g.rules as unknown as GameState['rules']);
      out.game = g as unknown as GameState;
    } catch {
      // Invalid rules: fall back to a fresh game.
    }
  }

  if (isCents(raw.bet)) out.bet = raw.bet;
  if (isRecord(raw.stats) && Number.isInteger(raw.stats.rounds)) out.stats = raw.stats as unknown as SessionStats;
  if (Array.isArray(raw.mistakes)) out.mistakes = raw.mistakes as Mistake[];
  return out;
}

/** The app-wide store. */
export const gameStore = createGameStore();

export function useGameStore<T>(selector: (state: GameStoreState) => T): T {
  return useStore(gameStore, selector);
}

// --- Selectors -------------------------------------------------------------

export const selectCount = (s: GameStoreState): CountInfo => countInfo(s.game, countingSystem(s.settings.countingSystem));

/** The live count. Shallow-compared, since `countInfo` builds a fresh object each time. */
export function useCountInfo(): CountInfo {
  return useStore(gameStore, useShallow(selectCount));
}
