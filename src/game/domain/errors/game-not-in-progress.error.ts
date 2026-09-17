import { GameDomainError } from './game-domain.error';

export class GameNotInProgressError extends GameDomainError {
  constructor() {
    super('CONFLICT', 'Ván chơi đã kết thúc');
  }
}
