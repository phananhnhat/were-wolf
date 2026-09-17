import { GameRepository } from '../../domain/repositories/game.repository';
import { GamePlayerRepository } from '../../domain/repositories/game-player.repository';
import { GameActionRepository } from '../../domain/repositories/game-action.repository';
import { GameVoteRepository } from '../../domain/repositories/game-vote.repository';
import { GameId } from '../../domain/value-objects/game-id.vo';
import { PlayerId } from '../../domain/value-objects/player-id.vo';
import { Role } from '../../domain/value-objects/role.vo';
import { GamePhase } from '../../domain/enums/game-phase.enum';
import { GameActionType } from '../../domain/enums/game-action-type.enum';
import { GameAction } from '../../domain/entities/game-action.entity';
import { GameRulesService } from '../../domain/services/game-rules.service';
import { VoteTally } from '../../domain/services/vote-tally.service';
import { GameNotFoundError } from '../../domain/errors/game-not-found.error';
import { PlayerNotInGameError } from '../../domain/errors/player-not-in-game.error';
import { SkillAlreadyUsedError } from '../../domain/errors/skill-already-used.error';

export interface WitchHealOutput {
  dayNumber: number;
  targetUserId: number;
}

// Phù thuỷ cứu nạn nhân bị Sói cắn đêm nay — dùng được ĐÚNG 1 LẦN CẢ VÁN, chỉ ở pha SKILL.
// KHÔNG nhận mục tiêu từ client: mục tiêu luôn là nạn nhân của lượt này, tự tính từ phiếu Sói
// rồi tự ghi — để client gửi lên sẽ mở đường dò nạn nhân bằng cách thử từng id. Xem
// docs/impl-phu-thuy.md §3.5.
export async function witchHeal(
  games: GameRepository,
  players: GamePlayerRepository,
  votes: GameVoteRepository,
  actions: GameActionRepository,
  gameId: number,
  actorId: number,
): Promise<WitchHealOutput> {
  const gid = GameId.of(gameId);
  const actorPid = PlayerId.of(actorId);

  const game = await games.findById(gid);
  if (!game) throw new GameNotFoundError();

  const actor = await players.findByGameAndUser(gid, actorPid);
  if (!actor) throw new PlayerNotInGameError();

  GameRulesService.assertCanUseSkill(
    game,
    actor,
    Role.WITCH,
    'Phù thuỷ',
    GamePhase.SKILL,
  );

  // Luật riêng của Phù thuỷ: mỗi bình chỉ dùng 1 lần CẢ VÁN.
  const already = await actions.findOneByActorThisGame(
    gid,
    actorPid,
    GameActionType.WITCH_HEAL,
  );
  if (already) {
    throw new SkillAlreadyUsedError('Bạn đã dùng hết bình thuốc cứu rồi');
  }

  const wolfVotes = await votes.findByPhase(
    gid,
    GamePhase.NIGHT,
    game.dayNumber,
  );
  const victimId = VoteTally.pickUniqueMaxTarget(
    VoteTally.tallyByTarget(wolfVotes),
  );
  GameRulesService.assertVictimExistsToHeal(victimId);

  // Chiều chặn "vừa cứu vừa độc cùng một người" — độc dùng ở NIGHT nên luôn xảy ra trước cứu ở
  // SKILL. Xem docs/impl-phu-thuy.md §3.5.
  const poison = await actions.findOneByActorAndDay(
    gid,
    game.dayNumber,
    GameActionType.WITCH_POISON,
    actorPid,
  );
  GameRulesService.assertWitchNotHealingPoisonedTarget(
    victimId,
    poison?.targetId ?? null,
  );

  const action = GameAction.record({
    gameId: game.id.toNumber(),
    dayNumber: game.dayNumber,
    actionType: GameActionType.WITCH_HEAL,
    actorId: actorPid,
    targetId: victimId,
    result: null,
  });

  try {
    await actions.record(action);
  } catch (err) {
    if (err instanceof SkillAlreadyUsedError) {
      throw new SkillAlreadyUsedError('Bạn đã dùng hết bình thuốc cứu rồi');
    }
    throw err;
  }

  return { dayNumber: game.dayNumber, targetUserId: victimId.toNumber() };
}
