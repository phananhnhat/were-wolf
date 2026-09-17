import { GameDomainError } from './game-domain.error';

export class PlayerDeadError extends GameDomainError {
  private constructor(message: string) {
    super('FORBIDDEN', message);
  }

  static forSkill(): PlayerDeadError {
    return new PlayerDeadError('Bạn đã chết, không thể dùng kỹ năng');
  }

  static forVote(): PlayerDeadError {
    return new PlayerDeadError('Bạn đã chết, không thể bỏ phiếu');
  }
}
