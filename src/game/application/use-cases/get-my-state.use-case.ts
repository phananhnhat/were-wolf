import { GameRepository } from '../../domain/repositories/game.repository';
import { GamePlayerRepository } from '../../domain/repositories/game-player.repository';
import { GameVoteRepository } from '../../domain/repositories/game-vote.repository';
import { GameActionRepository } from '../../domain/repositories/game-action.repository';
import { GameId } from '../../domain/value-objects/game-id.vo';
import { PlayerId } from '../../domain/value-objects/player-id.vo';
import { Role } from '../../domain/value-objects/role.vo';
import { GamePhase } from '../../domain/enums/game-phase.enum';
import { GameActionType } from '../../domain/enums/game-action-type.enum';
import { SeerCheckResult } from '../../domain/enums/seer-check-result.enum';
import { GameRulesService } from '../../domain/services/game-rules.service';
import { VoteTally } from '../../domain/services/vote-tally.service';
import { GameNotFoundError } from '../../domain/errors/game-not-found.error';
import { PlayerNotInGameError } from '../../domain/errors/player-not-in-game.error';

export interface GetMyStateOutput {
  userId: number;
  role: string;
  isAlive: boolean;
  canVoteNow: boolean;
  myVoteTargetId: number | null;
  teammates?: number[];
  seer?: {
    canCheckNow: boolean;
    checkedThisNight: { targetUserId: number; isWerewolf: boolean } | null;
  };
  guardian?: {
    canProtectNow: boolean;
    protectedThisNight: { targetUserId: number } | null;
    blockedTargetUserId: number | null;
  };
  witch?: {
    canPoisonNow: boolean;
    canHealNow: boolean;
    poisonAvailable: boolean;
    healAvailable: boolean;
    victimTonight: number | null;
    poisonedThisNight: { targetUserId: number } | null;
    healedThisNight: { targetUserId: number } | null;
  };
}

// Thông tin riêng của người gọi trong một ván: vai của mình, đồng đội (chỉ Sói mới có), và
// hiện tại làm được gì. Đây là chỗ duy nhất trả dữ liệu bí mật, và danh tính luôn lấy từ
// access token (userId truyền vào từ Interface layer) chứ không từ tham số client gửi lên.
export async function getMyState(
  games: GameRepository,
  players: GamePlayerRepository,
  votes: GameVoteRepository,
  actions: GameActionRepository,
  gameId: number,
  userId: number,
): Promise<GetMyStateOutput> {
  const gid = GameId.of(gameId);
  const userPid = PlayerId.of(userId);

  const game = await games.findById(gid);
  if (!game) throw new GameNotFoundError();

  const roster = await players.findByGameId(gid);
  const me = roster.find((p) => p.isOwnedBy(userPid));
  if (!me) throw new PlayerNotInGameError();

  const myVote = await votes.findByVoter(
    gid,
    game.phase,
    game.dayNumber,
    userPid,
  );

  const base = {
    userId: me.userId.toNumber(),
    role: me.role.toKey(),
    isAlive: me.isAlive,
    canVoteNow: GameRulesService.canVoteNow(game, me),
    myVoteTargetId: myVote?.targetId.toNumber() ?? null,
  };

  // Sói biết nhau từ đầu ván, kể cả đồng đội đã chết — cái biết đó không mất đi.
  if (me.isWerewolf()) {
    return {
      ...base,
      teammates: roster
        .filter((p) => !p.isOwnedBy(userPid) && p.isWerewolf())
        .map((p) => p.userId.toNumber()),
    };
  }

  // Tiên tri cần biết TRƯỚC khi bấm là đêm nay còn quyền soi không, và nếu soi rồi thì kết quả
  // là gì (để F5 hay đổi máy không mất thông tin). Xem docs/role-tien-tri.md §6.4.
  if (me.role.equals(Role.SEER)) {
    const check = await actions.findOneByActorAndDay(
      gid,
      game.dayNumber,
      GameActionType.SEER_CHECK,
      userPid,
    );
    return {
      ...base,
      seer: {
        canCheckNow:
          GameRulesService.canUseSkillNow(game, me, GamePhase.NIGHT) && !check,
        checkedThisNight: check
          ? {
              targetUserId: check.targetId.toNumber(),
              isWerewolf: check.result === SeerCheckResult.WEREWOLF,
            }
          : null,
      },
    };
  }

  // Bảo vệ cần biết trước: đêm nay còn quyền che không, đã che ai, và ai đang bị cấm vì mới
  // che đêm trước. Không có thông tin nào ở đây là bí mật của người khác — Bảo vệ vốn đã tự
  // biết mình che ai.
  if (me.role.equals(Role.GUARDIAN)) {
    const [tonight, lastNight] = await Promise.all([
      actions.findOneByActorAndDay(
        gid,
        game.dayNumber,
        GameActionType.GUARDIAN_PROTECT,
        userPid,
      ),
      game.dayNumber === 0
        ? Promise.resolve(null)
        : actions.findOneByActorAndDay(
            gid,
            game.dayNumber - 1,
            GameActionType.GUARDIAN_PROTECT,
            userPid,
          ),
    ]);
    return {
      ...base,
      guardian: {
        canProtectNow:
          GameRulesService.canUseSkillNow(game, me, GamePhase.NIGHT) &&
          !tonight,
        protectedThisNight: tonight
          ? { targetUserId: tonight.targetId.toNumber() }
          : null,
        // Người không được chọn đêm nay vì đã che đêm trước — client tô mờ đi.
        blockedTargetUserId: lastNight?.targetId.toNumber() ?? null,
      },
    };
  }

  // Phù thuỷ cần biết: còn thuốc nào không (xét CẢ VÁN), lượt này đã dùng thuốc nào chưa, và
  // nạn nhân của đêm nay — nhưng CHỈ khi đang ở pha kỹ năng (ngoài pha đó luôn rỗng, xem
  // docs/impl-phu-thuy.md §3.6).
  if (me.role.equals(Role.WITCH)) {
    const [poisonUsed, healUsed, poisonTonight, healTonight] =
      await Promise.all([
        actions.findOneByActorThisGame(
          gid,
          userPid,
          GameActionType.WITCH_POISON,
        ),
        actions.findOneByActorThisGame(gid, userPid, GameActionType.WITCH_HEAL),
        actions.findOneByActorAndDay(
          gid,
          game.dayNumber,
          GameActionType.WITCH_POISON,
          userPid,
        ),
        actions.findOneByActorAndDay(
          gid,
          game.dayNumber,
          GameActionType.WITCH_HEAL,
          userPid,
        ),
      ]);

    let victimTonight: PlayerId | null = null;
    if (game.isPhase(GamePhase.SKILL)) {
      const wolfVotes = await votes.findByPhase(
        gid,
        GamePhase.NIGHT,
        game.dayNumber,
      );
      victimTonight = VoteTally.pickUniqueMaxTarget(
        VoteTally.tallyByTarget(wolfVotes),
      );
    }

    return {
      ...base,
      witch: {
        canPoisonNow:
          GameRulesService.canUseSkillNow(game, me, GamePhase.NIGHT) &&
          !poisonUsed,
        canHealNow:
          GameRulesService.canUseSkillNow(game, me, GamePhase.SKILL) &&
          !healUsed &&
          victimTonight !== null,
        poisonAvailable: !poisonUsed,
        healAvailable: !healUsed,
        victimTonight: victimTonight?.toNumber() ?? null,
        poisonedThisNight: poisonTonight
          ? { targetUserId: poisonTonight.targetId.toNumber() }
          : null,
        healedThisNight: healTonight
          ? { targetUserId: healTonight.targetId.toNumber() }
          : null,
      },
    };
  }

  // Vai khác không có khoá `teammates`, `seer`, `guardian` lẫn `witch` — kể cả rỗng, vì sự tồn
  // tại của khoá cũng đã là một tín hiệu rò rỉ.
  return base;
}
