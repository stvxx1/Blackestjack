import type { GameState, PlayerMove } from './game';

/** Running session statistics. Money is in cents. */
export interface SessionStats {
  readonly rounds: number;
  readonly hands: number;
  readonly wins: number;
  readonly losses: number;
  readonly pushes: number;
  readonly blackjacks: number;
  readonly busts: number;
  readonly surrenders: number;
  readonly wagered: number;
  readonly net: number;
  readonly biggestWin: number;
  readonly biggestLoss: number;
  readonly peakBankroll: number;
  readonly lowBankroll: number;
  readonly decisions: number;
  readonly mistakes: number;
  /** Expected value given up by mistakes, in cents. */
  readonly evLost: number;
}

export interface Mistake {
  readonly round: number;
  readonly at: number;
  readonly hand: readonly string[];
  readonly upcard: string;
  readonly chose: PlayerMove | 'insure' | 'decline';
  readonly correct: PlayerMove | 'insure' | 'decline';
  /** Index play that applied, e.g. "16 v 10". */
  readonly deviation: string | null;
  readonly trueCount: number | null;
  readonly evLost: number;
}

export const MISTAKE_LOG_LIMIT = 200;

export function emptySessionStats(bankroll: number): SessionStats {
  return {
    rounds: 0, hands: 0, wins: 0, losses: 0, pushes: 0, blackjacks: 0, busts: 0, surrenders: 0,
    wagered: 0, net: 0, biggestWin: 0, biggestLoss: 0,
    peakBankroll: bankroll, lowBankroll: bankroll,
    decisions: 0, mistakes: 0, evLost: 0,
  };
}

/** Folds a settled round into the stats. Rounds still in play are ignored. */
export function recordRound(stats: SessionStats, state: GameState): SessionStats {
  const result = state.result;
  if (state.phase !== 'roundOver' || !result) return stats;
  let { wins, losses, pushes, blackjacks, busts, surrenders, wagered } = stats;
  for (const h of result.hands) {
    wagered += h.wagered;
    switch (h.outcome) {
      case 'blackjack':
        blackjacks++;
        wins++;
        break;
      case 'win':
        wins++;
        break;
      case 'push':
        pushes++;
        break;
      case 'bust':
        busts++;
        losses++;
        break;
      case 'surrender':
        surrenders++;
        losses++;
        break;
      case 'lose':
        losses++;
        break;
    }
  }
  if (result.insurance) wagered += result.insurance.wagered;
  return {
    ...stats,
    rounds: stats.rounds + 1,
    hands: stats.hands + result.hands.length,
    wins, losses, pushes, blackjacks, busts, surrenders, wagered,
    net: stats.net + result.net,
    biggestWin: Math.max(stats.biggestWin, result.net),
    biggestLoss: Math.min(stats.biggestLoss, result.net),
    peakBankroll: Math.max(stats.peakBankroll, state.bankroll),
    lowBankroll: Math.min(stats.lowBankroll, state.bankroll),
  };
}

export function recordDecision(stats: SessionStats, mistake: boolean, evLostCents: number): SessionStats {
  return {
    ...stats,
    decisions: stats.decisions + 1,
    mistakes: stats.mistakes + (mistake ? 1 : 0),
    evLost: stats.evLost + (mistake ? evLostCents : 0),
  };
}

export function logMistake(log: readonly Mistake[], mistake: Mistake): Mistake[] {
  return [mistake, ...log].slice(0, MISTAKE_LOG_LIMIT);
}

/** Wins over decided hands (pushes excluded). */
export const winRate = (s: SessionStats): number => (s.wins + s.losses === 0 ? 0 : s.wins / (s.wins + s.losses));
export const decisionAccuracy = (s: SessionStats): number => (s.decisions === 0 ? 1 : 1 - s.mistakes / s.decisions);
/** Net result per unit wagered: the edge you've actually experienced. */
export const observedReturn = (s: SessionStats): number => (s.wagered === 0 ? 0 : s.net / s.wagered);
