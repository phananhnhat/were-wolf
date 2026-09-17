import { GameDomainError } from './game-domain.error';

export class TargetNotFoundError extends GameDomainError {
  constructor() {
    super('NOT_FOUND', 'Người chơi không thuộc ván này');
  }
}
