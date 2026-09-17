import { GameRepository } from '../../domain/repositories/game.repository';
import { GameStatus } from '../../domain/enums/game-status.enum';
import { GamePhaseScheduler } from '../ports/game-phase-scheduler';

export const CANCEL_GAMES_FOR_ROOM_USE_CASE = Symbol(
  'CANCEL_GAMES_FOR_ROOM_USE_CASE',
);

// Chủ phòng xoá phòng giữa ván (RoomsModule phát sự kiện tương đương 'room.deleted') — huỷ
// (CANCELLED) mọi ván đang chạy của phòng đó, không có phe thắng. Thay handleRoomDeleted()
// trong game.service.ts.
export class CancelGamesForRoomUseCase {
  constructor(
    private readonly games: GameRepository,
    private readonly scheduler: GamePhaseScheduler,
  ) {}

  async execute(roomId: number): Promise<void> {
    const games = await this.games.findAllByRoomIdAndStatus(
      roomId,
      GameStatus.IN_PROGRESS,
    );

    for (const game of games) {
      this.scheduler.cancel(game.id);
      game.cancel();
      await this.games.save(game);
    }
  }
}
