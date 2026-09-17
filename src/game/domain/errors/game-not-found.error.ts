import { GameDomainError } from './game-domain.error';

export class GameNotFoundError extends GameDomainError {
  constructor() {
    super('NOT_FOUND', 'Không tìm thấy ván chơi');
  }
}
