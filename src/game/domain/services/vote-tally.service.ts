import { GameVote } from '../entities/game-vote.entity';
import { PlayerId } from '../value-objects/player-id.vo';

// Kiểm phiếu thuần tuý — không I/O. Dùng chung cho phiếu cắn (NIGHT) và phiếu treo cổ (DAY),
// nơi gọi tự lọc đúng phase/dayNumber trước khi đưa vào đây.
export class VoteTally {
  static tallyByTarget(votes: GameVote[]): Map<number, number> {
    const tally = new Map<number, number>();
    for (const vote of votes) {
      const key = vote.targetId.toNumber();
      tally.set(key, (tally.get(key) ?? 0) + 1);
    }
    return tally;
  }

  // Trả về targetId duy nhất có số phiếu cao nhất, hoặc null nếu hòa phiếu / không ai vote.
  static pickUniqueMaxTarget(tally: Map<number, number>): PlayerId | null {
    let maxCount = 0;
    let maxTargetId: number | null = null;
    let isTie = false;

    for (const [targetId, count] of tally) {
      if (count > maxCount) {
        maxCount = count;
        maxTargetId = targetId;
        isTie = false;
      } else if (count === maxCount) {
        isTie = true;
      }
    }

    return maxCount > 0 && !isTie && maxTargetId !== null
      ? PlayerId.of(maxTargetId)
      : null;
  }
}
