import { GameDomainError } from './game-domain.error';

export class NoVictimToHealError extends GameDomainError {
  constructor() {
    super('CONFLICT', 'Đêm nay không có ai bị Sói cắn để cứu');
  }
}
