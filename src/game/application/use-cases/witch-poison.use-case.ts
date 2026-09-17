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

export interface WitchPoisonOutput {
  dayNumber: number;
  targetUserId: number;
}

// Phù thuỷ đầu độc 1 người bất kỳ đêm nay — dùng được ĐÚNG 1 LẦN CẢ VÁN. Bảo vệ không chặn
// được, thuốc cứu không cứu được. Xem docs/impl-phu-thuy.md §3.5.
export async function witchPoison(
  games: GameRepository,
  players: GamePlayerRepository,
  actions: GameActionRepository,
  gameId: number,
  actorId: number,
  targetUserId: number,
): Promise<WitchPoisonOutput> {
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
    Role.WITCH,
    'Phù thuỷ',
    GamePhase.NIGHT,
  );

  // Luật riêng của Phù thuỷ: mỗi bình chỉ dùng 1 lần CẢ VÁN, không phải mỗi đêm.
  const already = await actions.findOneByActorThisGame(
    gid,
    actorPid,
    GameActionType.WITCH_POISON,
  );
  if (already) {
    throw new SkillAlreadyUsedError('Bạn đã dùng hết bình thuốc độc rồi');
  }

  GameRulesService.assertNotSelfTarget(actorPid, targetPid, 'đầu độc');

  const target = await players.findByGameAndUser(gid, targetPid);
  GameRulesService.assertLivingTarget(target);

  const action = GameAction.record({
    gameId: game.id.toNumber(),
    dayNumber: game.dayNumber,
    actionType: GameActionType.WITCH_POISON,
    actorId: actorPid,
    targetId: targetPid,
    result: null,
  });

  try {
    await actions.record(action);
  } catch (err) {
    if (err instanceof SkillAlreadyUsedError) {
      throw new SkillAlreadyUsedError('Bạn đã dùng hết bình thuốc độc rồi');
    }
    throw err;
  }

  return { dayNumber: game.dayNumber, targetUserId };
}
