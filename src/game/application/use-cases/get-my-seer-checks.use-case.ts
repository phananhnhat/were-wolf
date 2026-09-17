import { GamePlayerRepository } from '../../domain/repositories/game-player.repository';
import { GameActionRepository } from '../../domain/repositories/game-action.repository';
import { GameId } from '../../domain/value-objects/game-id.vo';
import { PlayerId } from '../../domain/value-objects/player-id.vo';
import { Role } from '../../domain/value-objects/role.vo';
import { GameActionType } from '../../domain/enums/game-action-type.enum';
import { SeerCheckResult } from '../../domain/enums/seer-check-result.enum';
import { PlayerNotInGameError } from '../../domain/errors/player-not-in-game.error';
import { RoleNotAllowedError } from '../../domain/errors/role-not-allowed.error';

export const GET_MY_SEER_CHECKS_USE_CASE = Symbol(
  'GET_MY_SEER_CHECKS_USE_CASE',
);

export interface SeerChecksOutput {
  checks: Array<{
    dayNumber: number;
    targetUserId: number;
    isWerewolf: boolean;
  }>;
}

// Lịch sử soi của CHÍNH người gọi từ đầu ván. Luôn lọc theo danh tính lấy từ access token
// (actorId truyền vào từ Interface layer), không bao giờ theo tham số client gửi lên — xem
// docs/role-tien-tri.md §7.
export class GetMySeerChecksUseCase {
  constructor(
    private readonly players: GamePlayerRepository,
    private readonly actions: GameActionRepository,
  ) {}

  async execute(gameId: number, actorId: number): Promise<SeerChecksOutput> {
    const gid = GameId.of(gameId);
    const actorPid = PlayerId.of(actorId);

    const actor = await this.players.findByGameAndUser(gid, actorPid);
    if (!actor) throw new PlayerNotInGameError();
    if (!actor.role.equals(Role.SEER)) {
      throw new RoleNotAllowedError('Chỉ Tiên tri mới xem được lịch sử soi');
    }

    const checks = await this.actions.findAllByActor(gid, actorPid, [
      GameActionType.SEER_CHECK,
    ]);

    return {
      checks: checks.map((c) => ({
        dayNumber: c.dayNumber,
        targetUserId: c.targetId.toNumber(),
        isWerewolf: c.result === SeerCheckResult.WEREWOLF,
      })),
    };
  }
}
