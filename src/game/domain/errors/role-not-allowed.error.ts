import { GameDomainError } from './game-domain.error';

// "Chỉ vai X mới được làm Y" — dùng chung cho dùng kỹ năng sai vai, xem kiểm phiếu ban đêm
// không phải Sói, xem lịch sử kỹ năng không đúng vai. Message khác nhau tuỳ Y, nên nhận thẳng
// message thay vì cố định chuỗi.
export class RoleNotAllowedError extends GameDomainError {
  constructor(message: string) {
    super('FORBIDDEN', message);
  }

  static forSkill(roleLabel: string): RoleNotAllowedError {
    return new RoleNotAllowedError(
      `Chỉ ${roleLabel} mới dùng được kỹ năng này`,
    );
  }
}
