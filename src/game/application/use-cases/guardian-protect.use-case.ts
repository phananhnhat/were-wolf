import { GameRepository } from '../../domain/repositories/game.repository';
import { GamePlayerRepository } from '../../domain/repositories/game-player.repository';
import { GameActionRepository } from '../../domain/repositories/game-action.repository';
import { GameId } from '../../domain/value-objects/game-id.vo';
import { PlayerId } from '../../domain/value-objects/player-id.vo';
import { Role } from '../../domain/value-objects/role.vo';
import { GamePhase } from '../../domain/enums/game-phase.enum';
import { GameActionType } from '../../domain/enums/game-action-type.enum';
import { GameAction } from '../../domain/entities/game-action.entity';
import { GameRulesService } from '../../domain/services/game-rules.service';
import { GameNotFoundError } from '../../domain/errors/game-not-found.error';
import { PlayerNotInGameError } from '../../domain/errors/player-not-in-game.error';
import { SkillAlreadyUsedError } from '../../domain/errors/skill-already-used.error';

export interface GuardianProtectOutput {
  dayNumber: number;
  targetUserId: number;
}

// Bảo vệ chọn 1 người để che trong đêm nay. Nếu Sói cắn đúng người đó thì không ai chết. Bảo
// vệ KHÔNG biết mình che trúng hay không — biết được tức là biết luôn Sói nhắm ai. Xem
// docs/role-bao-ve.md.
export async function guardianProtect(
  games: GameRepository,
  players: GamePlayerRepository,
  actions: GameActionRepository,
  gameId: number,
  actorId: number,
  targetUserId: number,
): Promise<GuardianProtectOutput> {
  const gid = GameId.of(gameId);
  const actorPid = PlayerId.of(actorId);
  const targetPid = PlayerId.of(targetUserId);

  const game = await games.findById(gid);
  if (!game) throw new GameNotFoundError();

  const actor = await players.findByGameAndUser(gid, actorPid);
  if (!actor) throw new PlayerNotInGameError();

  GameRulesService.assertCanUseSkill(
    game,
    actor,
    Role.GUARDIAN,
    'Bảo vệ',
    GamePhase.NIGHT,
  );

  // Luật riêng của Bảo vệ: mỗi ĐÊM đúng 1 lần.
  const already = await actions.findOneByActorAndDay(
    gid,
    game.dayNumber,
    GameActionType.GUARDIAN_PROTECT,
    actorPid,
  );
  if (already) {
    throw new SkillAlreadyUsedError('Đêm nay bạn đã dùng kỹ năng rồi');
  }

  GameRulesService.assertNotSelfTarget(actorPid, targetPid, 'bảo vệ');

  // Không được che cùng một người 2 đêm liên tiếp.
  const lastNight =
    game.dayNumber === 0
      ? null
      : await actions.findOneByActorAndDay(
          gid,
          game.dayNumber - 1,
          GameActionType.GUARDIAN_PROTECT,
          actorPid,
        );
  GameRulesService.assertGuardianNotRepeatingTarget(
    targetPid,
    lastNight?.targetId ?? null,
  );

  const target = await players.findByGameAndUser(gid, targetPid);
  GameRulesService.assertLivingTarget(target);

  const action = GameAction.record({
    gameId: game.id.toNumber(),
    dayNumber: game.dayNumber,
    actionType: GameActionType.GUARDIAN_PROTECT,
    actorId: actorPid,
    targetId: targetPid,
    // Không có kết quả trả về: che trúng hay trượt đều không được báo.
    result: null,
  });

  try {
    await actions.record(action);
  } catch (err) {
    if (err instanceof SkillAlreadyUsedError) {
      throw new SkillAlreadyUsedError('Đêm nay bạn đã dùng kỹ năng rồi');
    }
    throw err;
  }

  // Cố ý KHÔNG trả bất cứ thông tin gì về mục tiêu (vai, phe, có bị nhắm không).
  return { dayNumber: game.dayNumber, targetUserId };
}
