import { GamePlayerRepository } from '../../domain/repositories/game-player.repository';
import { GameActionRepository } from '../../domain/repositories/game-action.repository';
import { GameId } from '../../domain/value-objects/game-id.vo';
import { PlayerId } from '../../domain/value-objects/player-id.vo';
import { Role } from '../../domain/value-objects/role.vo';
import { GameActionType } from '../../domain/enums/game-action-type.enum';
import { PlayerNotInGameError } from '../../domain/errors/player-not-in-game.error';
import { RoleNotAllowedError } from '../../domain/errors/role-not-allowed.error';

export interface WitchActionsOutput {
  actions: Array<{
    dayNumber: number;
    type: GameActionType;
    targetUserId: number;
  }>;
}

// Lịch sử dùng cả 2 loại thuốc của chính người gọi, từ đầu ván.
export async function getMyWitchActions(
  players: GamePlayerRepository,
  actions: GameActionRepository,
  gameId: number,
  actorId: number,
): Promise<WitchActionsOutput> {
  const gid = GameId.of(gameId);
  const actorPid = PlayerId.of(actorId);

  const actor = await players.findByGameAndUser(gid, actorPid);
  if (!actor) throw new PlayerNotInGameError();
  if (!actor.role.equals(Role.WITCH)) {
    throw new RoleNotAllowedError('Chỉ Phù thuỷ mới xem được lịch sử này');
  }

  const rows = await actions.findAllByActor(gid, actorPid, [
    GameActionType.WITCH_HEAL,
    GameActionType.WITCH_POISON,
  ]);

  return {
    actions: rows.map((r) => ({
      dayNumber: r.dayNumber,
      type: r.actionType,
      targetUserId: r.targetId.toNumber(),
    })),
  };
}
