import { GamePlayer } from '../entities/game-player.entity';
import { GameVote } from '../entities/game-vote.entity';
import { PlayerId } from '../value-objects/player-id.vo';
import { VoteTally } from './vote-tally.service';

export interface NightResolutionInput {
  players: GamePlayer[];
  wolfVotes: GameVote[];
  // Mục tiêu Bảo vệ che đêm nay, nếu có — null nếu không ai che.
  guardianProtectTargetId: PlayerId | null;
  // Mục tiêu Phù thuỷ cứu đêm nay, nếu có — luôn trùng nạn nhân bị Sói cắn (witchHeal() tự
  // tính mục tiêu, không nhận từ client), nhưng vẫn so lại tường minh ở đây cho chắc chắn.
  witchHealTargetId: PlayerId | null;
  // Mục tiêu Phù thuỷ đầu độc đêm nay, nếu có.
  witchPoisonTargetId: PlayerId | null;
}

// Áp dụng toàn bộ cái chết của một đêm — Sói cắn (trừ Bảo vệ che, trừ thuốc cứu) và thuốc độc
// (không ai chặn được), gộp vào MỘT TẬP rồi đánh dấu chết cùng lúc (không đếm trùng nếu độc
// đúng người bị cắn). Thuần: không đọc/ghi gì, chỉ nhận state đã có sẵn và trả về ai vừa chết
// (đã gọi player.kill()). Xem docs/impl-phu-thuy.md §3.2.
export class NightResolutionService {
  static resolveDeaths(input: NightResolutionInput): GamePlayer[] {
    const deadByUserId = new Map<number, GamePlayer>();

    const victimId = VoteTally.pickUniqueMaxTarget(
      VoteTally.tallyByTarget(input.wolfVotes),
    );
    if (victimId !== null) {
      const protectedByGuardian =
        input.guardianProtectTargetId?.equals(victimId) ?? false;
      const savedByWitch = input.witchHealTargetId?.equals(victimId) ?? false;
      if (!protectedByGuardian && !savedByWitch) {
        const victim = findPlayer(input.players, victimId);
        if (victim) deadByUserId.set(victim.userId.toNumber(), victim);
      }
    }

    if (input.witchPoisonTargetId) {
      const poisoned = findPlayer(input.players, input.witchPoisonTargetId);
      if (poisoned) deadByUserId.set(poisoned.userId.toNumber(), poisoned);
    }

    const deaths = [...deadByUserId.values()];
    for (const player of deaths) player.kill();
    return deaths;
  }
}

function findPlayer(
  players: GamePlayer[],
  userId: PlayerId,
): GamePlayer | undefined {
  return players.find((p) => p.isOwnedBy(userId));
}
