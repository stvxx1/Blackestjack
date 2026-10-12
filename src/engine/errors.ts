export type GameErrorCode =
  | 'INVALID_RULES'
  | 'ILLEGAL_ACTION'
  | 'INVALID_BET'
  | 'INSUFFICIENT_FUNDS';

export class GameError extends Error {
  readonly code: GameErrorCode;

  constructor(code: GameErrorCode, message: string) {
    super(message);
    this.name = 'GameError';
    this.code = code;
  }
}
