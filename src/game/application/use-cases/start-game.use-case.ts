import { GameRepository } from '../../domain/repositories/game.repository';
import { PlayerId } from '../../domain/value-objects/player-id.vo';
import { PHASE_DURATION_MS } from '../../domain/value-objects/phase-duration';
import { GameStatus } from '../../domain/enums/game-status.enum';
import { GamePhase } from '../../domain/enums/game-phase.enum';
import { Game } from '../../domain/entities/game.entity';
import { GamePlayer } from '../../domain/entities/game-player.entity';
import { RoleAssignmentService } from '../../domain/services/role-assignment.service';
import { GameUnitOfWork } from '../ports/game-unit-of-work';
import { GamePhaseScheduler } from '../ports/game-phase-scheduler';
import { GameEventPublisher } from '../ports/game-event-publisher';
import { Logger } from '../ports/logger';
import {
  ROLE_CONFIG_BY_MAX_PLAYERS,
  MaxPlayers,
} from '../../../rooms/constants/room-configs';

export const START_GAME_USE_CASE = Symbol('START_GAME_USE_CASE');

export interface StartGameInput {
  roomId: number;
  maxPlayers: number;
  memberIds: number[];
}

// Chủ phòng vừa bấm bắt đầu (RoomsModule phát sự kiện tương đương 'room.started') — tạo ván +
// chia vai. Thay handleRoomStarted() trong game.service.ts.
export class StartGameUseCase {
  constructor(
    private readonly games: GameRepository,
    private readonly unitOfWork: GameUnitOfWork,
    private readonly scheduler: GamePhaseScheduler,
    private readonly eventPublisher: GameEventPublisher,
    private readonly logger: Logger,
  ) {}

  async execute(input: StartGameInput): Promise<void> {
    const existing = await this.games.findByRoomIdAndStatus(
      input.roomId,
      GameStatus.IN_PROGRESS,
    );
    if (existing) {
      this.logger.warn(
        `Bỏ qua room.started trùng lặp cho room #${input.roomId}`,
      );
      return;
    }

    try {
      // Tạo ván + chia vai trong CÙNG 1 transaction: nếu ghi GamePlayer lỗi giữa chừng thì
      // Game vừa tạo cũng rollback theo, không để sót một ván "ma" — IN_PROGRESS nhưng 0
      // người chơi.
      const game = await this.unitOfWork.runInTransaction(async (repos) => {
        const nightEndsAt = new Date(
          Date.now() + PHASE_DURATION_MS[GamePhase.NIGHT],
        );
        const newGame = Game.start(input.roomId, nightEndsAt);
        // Hợp đồng save(): với Game chưa có id, implementation phải INSERT rồi
        // newGame.assignId(...) trước khi Promise resolve — nên đọc newGame.id ngay sau đây
        // là hợp lệ.
        await repos.games.save(newGame);

        const roleConfig =
          ROLE_CONFIG_BY_MAX_PLAYERS[input.maxPlayers as MaxPlayers];
        const roles = RoleAssignmentService.shuffleRoles(roleConfig);
        const players = input.memberIds.map((userId, i) =>
          GamePlayer.assignNew(
            newGame.id.toNumber(),
            PlayerId.of(userId),
            roles[i],
          ),
        );
        await repos.players.saveMany(players);

        return newGame;
      });

      // Hẹn giờ SAU KHI transaction đã commit — đây là side effect trong RAM, không phải ghi
      // DB, nên chỉ nên làm khi chắc chắn ván đã lưu thành công.
      this.scheduler.schedule(game.id, PHASE_DURATION_MS[GamePhase.NIGHT]);
    } catch (err) {
      this.logger.error(
        `Tạo ván cho room #${input.roomId} thất bại`,
        err instanceof Error ? err.stack : undefined,
      );
      this.eventPublisher.gameStartFailed(
        input.roomId,
        err instanceof Error ? err.message : 'unknown error',
      );
    }
  }
}
