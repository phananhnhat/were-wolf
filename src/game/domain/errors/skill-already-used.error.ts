import { GameDomainError } from './game-domain.error';

// Đã dùng lượt/kỹ năng rồi — Tiên tri/Bảo vệ tính theo đêm, Phù thuỷ tính theo cả ván (xem
// GameActionRepository). Message khác nhau theo vai nên nhận thẳng từ nơi gọi.
export class SkillAlreadyUsedError extends GameDomainError {
  constructor(message: string) {
    super('CONFLICT', message);
  }
}
