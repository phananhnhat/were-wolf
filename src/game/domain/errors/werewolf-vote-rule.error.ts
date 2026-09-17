import { GameDomainError } from './game-domain.error';

// Luật riêng của bỏ phiếu cắn: chỉ Sói được vote, và Sói không được chọn đồng đội (tự cắn
// mình cũng nằm trong luật này — voter và target trùng phe là đủ để chặn).
export class WerewolfVoteRuleError extends GameDomainError {
  private constructor(code: 'FORBIDDEN' | 'BAD_REQUEST', message: string) {
    super(code, message);
  }

  static onlyWerewolfCanVote(): WerewolfVoteRuleError {
    return new WerewolfVoteRuleError(
      'FORBIDDEN',
      'Chỉ Sói được chọn nạn nhân ban đêm',
    );
  }

  static cannotTargetAlly(): WerewolfVoteRuleError {
    return new WerewolfVoteRuleError(
      'BAD_REQUEST',
      'Ma Sói không thể cắn đồng đội',
    );
  }
}
