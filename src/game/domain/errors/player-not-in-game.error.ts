import { GameDomainError } from './game-domain.error';

export class PlayerNotInGameError extends GameDomainError {
  constructor() {
    super('FORBIDDEN', 'Bạn không thuộc ván chơi này');
  }
}
