import { GameDomainError } from './game-domain.error';

// Không được che cùng một người 2 đêm liên tiếp — thiếu luật này thì Bảo vệ khoá cứng được
// một người và phe Sói gần như không thể thắng.
export class GuardianRepeatTargetError extends GameDomainError {
  constructor() {
    super(
      'BAD_REQUEST',
      'Đêm trước bạn đã bảo vệ người này, không được chọn lại 2 đêm liên tiếp',
    );
  }
}
