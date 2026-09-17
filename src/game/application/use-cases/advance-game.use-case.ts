import { GameId } from '../../domain/value-objects/game-id.vo';
import { PHASE_DURATION_MS } from '../../domain/value-objects/phase-duration';
import { GamePhase } from '../../domain/enums/game-phase.enum';
import { GameWinner } from '../../domain/enums/game-winner.enum';
import { GameActionType } from '../../domain/enums/game-action-type.enum';
import { Game } from '../../domain/entities/game.entity';
import { GamePlayer } from '../../domain/entities/game-player.entity';
import { GameRulesService } from '../../domain/services/game-rules.service';
import { NightResolutionService } from '../../domain/services/night-resolution.service';
import { DayLynchService } from '../../domain/services/day-lynch.service';
import { WinConditionService } from '../../domain/services/win-condition.service';
import {
  GameUnitOfWork,
  GameTransactionalRepositories,
} from '../ports/game-unit-of-work';
import { GamePhaseScheduler } from '../ports/game-phase-scheduler';
import { GameEventPublisher } from '../ports/game-event-publisher';

// Ván vừa kết thúc (cần phát sự kiện SAU KHI transaction đã commit), hoặc ván tiếp tục sang 1
// pha mới (cần hẹn giờ cho pha đó).
type AdvanceOutcome =
  | { type: 'finished'; roomId: number }
  | { type: 'continued'; phase: GamePhase };

// Hết giờ một pha: NIGHT → SKILL (nếu còn Phù thuỷ sống, ngược lại xử lý cái chết và mở luôn
// DAY) → SKILL đóng thì xử lý cái chết rồi mở DAY → DAY đóng thì treo cổ rồi mở NIGHT (lượt
// +1). Thay advanceGame() + các helper riêng trong game.service.ts cũ — toàn bộ luật đã chuyển
// sang Domain layer ở bước trước, hàm này chỉ còn lấy dữ liệu, gọi domain, lưu lại.
//
// Toàn bộ việc ĐỌC + GHI diễn ra trong CÙNG 1 transaction — "đánh dấu người chết" và "chuyển
// pha/kết thúc ván" phải cùng thành công hoặc cùng rollback. Side effect NGOÀI DB (hẹn giờ
// trong RAM, phát sự kiện cho RoomsModule) cố ý để SAU KHI transaction đã commit. Xem
// docs/impl-phu-thuy.md §3.1, §3.2.
export async function advanceGame(
  unitOfWork: GameUnitOfWork,
  scheduler: GamePhaseScheduler,
  eventPublisher: GameEventPublisher,
  gameId: number,
): Promise<void> {
  const gid = GameId.of(gameId);

  const outcome = await unitOfWork.runInTransaction<AdvanceOutcome | null>(
    async (repos) => {
      const game = await repos.games.findById(gid);
      if (!game || !game.isInProgress()) return null;

      // Chốt chặn hẹn giờ bắn trùng: nếu phaseEndsAt còn ở tương lai nghĩa là một tick khác đã
      // xử lý xong pha này rồi (đã đẩy phaseEndsAt sang pha kế). Không làm gì để tránh ván
      // nhảy vọt một pha.
      if (game.phaseEndsAt && game.phaseEndsAt.getTime() > Date.now()) {
        return null;
      }

      const players = await repos.players.findByGameId(gid);

      // Xét "còn Phù thuỷ sống" TRƯỚC khi áp dụng cái chết của đêm nay — nên nếu chính Phù
      // thuỷ là nạn nhân, pha SKILL vẫn mở và cô ấy vẫn kịp tự cứu.
      if (
        game.isPhase(GamePhase.NIGHT) &&
        GameRulesService.hasAliveWitch(players)
      ) {
        return advanceToPhase(repos, game, GamePhase.SKILL);
      }

      if (game.isPhase(GamePhase.NIGHT) || game.isPhase(GamePhase.SKILL)) {
        await resolveNightDeaths(repos, game, players);
        const winner = WinConditionService.decideWinner(players);
        if (winner) return settleGame(repos, game, winner);
        return advanceToPhase(repos, game, GamePhase.DAY);
      }

      // DAY
      const votes = await repos.votes.findByPhase(
        gid,
        GamePhase.DAY,
        game.dayNumber,
      );
      const dead = DayLynchService.resolveLynch(votes, players);
      if (dead) await repos.players.save(dead);

      const winner = WinConditionService.decideWinner(players);
      if (winner) return settleGame(repos, game, winner);

      game.incrementDay();
      return advanceToPhase(repos, game, GamePhase.NIGHT);
    },
  );

  if (!outcome) return; // ván không còn chạy, hoặc bị chặn bởi chốt bắn trùng

  if (outcome.type === 'finished') {
    scheduler.cancel(gid);
    eventPublisher.gameFinished(outcome.roomId);
  } else {
    scheduler.schedule(gid, PHASE_DURATION_MS[outcome.phase]);
  }
}

async function advanceToPhase(
  repos: GameTransactionalRepositories,
  game: Game,
  phase: GamePhase,
): Promise<AdvanceOutcome> {
  game.advanceToPhase(phase, new Date(Date.now() + PHASE_DURATION_MS[phase]));
  await repos.games.save(game);
  return { type: 'continued', phase };
}

async function settleGame(
  repos: GameTransactionalRepositories,
  game: Game,
  winner: GameWinner,
): Promise<AdvanceOutcome> {
  game.finish(winner);
  await repos.games.save(game);
  return { type: 'finished', roomId: game.roomId };
}

// Áp dụng toàn bộ cái chết của một đêm — Sói cắn (trừ Bảo vệ che, trừ thuốc cứu) và thuốc độc
// (không ai chặn được), gộp vào MỘT TẬP rồi đánh dấu chết cùng lúc. Xem docs/impl-phu-thuy.md §3.2.
async function resolveNightDeaths(
  repos: GameTransactionalRepositories,
  game: Game,
  players: GamePlayer[],
): Promise<void> {
  const wolfVotes = await repos.votes.findByPhase(
    game.id,
    GamePhase.NIGHT,
    game.dayNumber,
  );
  const guardianAction = await repos.actions.findOneOfTypeThisTurn(
    game.id,
    game.dayNumber,
    GameActionType.GUARDIAN_PROTECT,
  );
  const healAction = await repos.actions.findOneOfTypeThisTurn(
    game.id,
    game.dayNumber,
    GameActionType.WITCH_HEAL,
  );
  const poisonAction = await repos.actions.findOneOfTypeThisTurn(
    game.id,
    game.dayNumber,
    GameActionType.WITCH_POISON,
  );

  const deaths = NightResolutionService.resolveDeaths({
    players,
    wolfVotes,
    guardianProtectTargetId: guardianAction?.targetId ?? null,
    witchHealTargetId: healAction?.targetId ?? null,
    witchPoisonTargetId: poisonAction?.targetId ?? null,
  });

  if (deaths.length > 0) {
    await repos.players.saveMany(deaths);
  }
}
