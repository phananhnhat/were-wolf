import { GameDomainError } from './game-domain.error';

export class TargetNotAliveError extends GameDomainError {
  constructor() {
    super('CONFLICT', 'Người chơi này đã chết');
  }
}
