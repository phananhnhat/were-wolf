import { GameDomainError } from './game-domain.error';

// Dùng kỹ năng hoặc bỏ phiếu sai pha hiện tại. Thông điệp khác nhau tuỳ ngữ cảnh (kỹ năng hay
// bỏ phiếu) nên tách 2 factory thay vì 1 message chung chung.
export class WrongPhaseError extends GameDomainError {
  private constructor(message: string) {
    super('CONFLICT', message);
  }

  static forSkill(): WrongPhaseError {
    return new WrongPhaseError('Kỹ năng này chưa tới lượt dùng');
  }

  static forVote(): WrongPhaseError {
    return new WrongPhaseError('Chưa tới lượt bỏ phiếu này');
  }
}
