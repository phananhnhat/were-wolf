import { GamePlayerRepository } from '../../domain/repositories/game-player.repository';
import { GameActionRepository } from '../../domain/repositories/game-action.repository';
import { GameId } from '../../domain/value-objects/game-id.vo';
import { PlayerId } from '../../domain/value-objects/player-id.vo';
import { Role } from '../../domain/value-objects/role.vo';
import { GameActionType } from '../../domain/enums/game-action-type.enum';
import { PlayerNotInGameError } from '../../domain/errors/player-not-in-game.error';
import { RoleNotAllowedError } from '../../domain/errors/role-not-allowed.error';

export const GET_MY_GUARDIAN_PROTECTS_USE_CASE = Symbol(
  'GET_MY_GUARDIAN_PROTECTS_USE_CASE',
);

export interface GuardianProtectsOutput {
  protects: Array<{ dayNumber: number; targetUserId: number }>;
}

// Lịch sử che của chính người gọi, từ đầu ván.
export class GetMyGuardianProtectsUseCase {
  constructor(
    private readonly players: GamePlayerRepository,
    private readonly actions: GameActionRepository,
  ) {}

  async execute(
    gameId: number,
    actorId: number,
  ): Promise<GuardianProtectsOutput> {
    const gid = GameId.of(gameId);
    const actorPid = PlayerId.of(actorId);

    const actor = await this.players.findByGameAndUser(gid, actorPid);
    if (!actor) throw new PlayerNotInGameError();
    if (!actor.role.equals(Role.GUARDIAN)) {
      throw new RoleNotAllowedError('Chỉ Bảo vệ mới xem được lịch sử này');
    }

    const rows = await this.actions.findAllByActor(gid, actorPid, [
      GameActionType.GUARDIAN_PROTECT,
    ]);

    return {
      protects: rows.map((r) => ({
        dayNumber: r.dayNumber,
        targetUserId: r.targetId.toNumber(),
      })),
    };
  }
}
