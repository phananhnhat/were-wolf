import { GameRepository } from '../../domain/repositories/game.repository';
import { GamePlayerRepository } from '../../domain/repositories/game-player.repository';
import { GameActionRepository } from '../../domain/repositories/game-action.repository';
import { GameId } from '../../domain/value-objects/game-id.vo';
import { PlayerId } from '../../domain/value-objects/player-id.vo';
import { Role } from '../../domain/value-objects/role.vo';
import { GamePhase } from '../../domain/enums/game-phase.enum';
import { GameActionType } from '../../domain/enums/game-action-type.enum';
import { SeerCheckResult } from '../../domain/enums/seer-check-result.enum';
import { GameAction } from '../../domain/entities/game-action.entity';
import { GameRulesService } from '../../domain/services/game-rules.service';
import { GameNotFoundError } from '../../domain/errors/game-not-found.error';
import { PlayerNotInGameError } from '../../domain/errors/player-not-in-game.error';
import { SkillAlreadyUsedError } from '../../domain/errors/skill-already-used.error';

export const SEER_CHECK_USE_CASE = Symbol('SEER_CHECK_USE_CASE');

export interface SeerCheckOutput {
  dayNumber: number;
  targetUserId: number;
  isWerewolf: boolean;
}

// Tiên tri soi 1 người trong đêm hiện tại, biết người đó có phải Sói hay không. Ghi một lần,
// KHÔNG sửa được — xem docs/role-tien-tri.md §2.
export class SeerCheckUseCase {
  constructor(
    private readonly games: GameRepository,
    private readonly players: GamePlayerRepository,
    private readonly actions: GameActionRepository,
  ) {}

  async execute(
    gameId: number,
    actorId: number,
    targetUserId: number,
  ): Promise<SeerCheckOutput> {
    const gid = GameId.of(gameId);
    const actorPid = PlayerId.of(actorId);
    const targetPid = PlayerId.of(targetUserId);

    const game = await this.games.findById(gid);
    if (!game) throw new GameNotFoundError();

    const actor = await this.players.findByGameAndUser(gid, actorPid);
    if (!actor) throw new PlayerNotInGameError();

    GameRulesService.assertCanUseSkill(
      game,
      actor,
      Role.SEER,
      'Tiên tri',
      GamePhase.NIGHT,
    );

    // Luật riêng của Tiên tri: mỗi ĐÊM đúng 1 lần. Tầng chặn 1 — tầng 2 là hợp đồng
    // record() ném lại SkillAlreadyUsedError khi vi phạm UNIQUE lúc ghi bên dưới.
    const already = await this.actions.findOneByActorAndDay(
      gid,
      game.dayNumber,
      GameActionType.SEER_CHECK,
      actorPid,
    );
    if (already) {
      throw new SkillAlreadyUsedError('Đêm nay bạn đã dùng lượt soi rồi');
    }

    GameRulesService.assertNotSelfTarget(actorPid, targetPid, 'soi');

    const target = await this.players.findByGameAndUser(gid, targetPid);
    GameRulesService.assertLivingTarget(target);

    // Chỉ nhị phân — không lộ tên vai cụ thể.
    const isWerewolf = target.isWerewolf();

    const action = GameAction.record({
      gameId: game.id.toNumber(),
      dayNumber: game.dayNumber,
      actionType: GameActionType.SEER_CHECK,
      actorId: actorPid,
      targetId: targetPid,
      result: isWerewolf
        ? SeerCheckResult.WEREWOLF
        : SeerCheckResult.NOT_WEREWOLF,
    });

    try {
      await this.actions.record(action);
    } catch (err) {
      if (err instanceof SkillAlreadyUsedError) {
        throw new SkillAlreadyUsedError('Đêm nay bạn đã dùng lượt soi rồi');
      }
      throw err;
    }

    return { dayNumber: game.dayNumber, targetUserId, isWerewolf };
  }
}
