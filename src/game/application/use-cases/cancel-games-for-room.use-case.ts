import { GameRepository } from '../../domain/repositories/game.repository';
import { GameStatus } from '../../domain/enums/game-status.enum';
import { GamePhaseScheduler } from '../ports/game-phase-scheduler';

// Chủ phòng xoá phòng giữa ván (RoomsModule phát sự kiện tương đương 'room.deleted') — huỷ
// (CANCELLED) mọi ván đang chạy của phòng đó, không có phe thắng. Thay handleRoomDeleted()
// trong game.service.ts.
export async function cancelGamesForRoom(
  games: GameRepository,
  scheduler: GamePhaseScheduler,
  roomId: number,
): Promise<void> {
  const activeGames = await games.findAllByRoomIdAndStatus(
    roomId,
    GameStatus.IN_PROGRESS,
  );

  for (const game of activeGames) {
    scheduler.cancel(game.id);
    game.cancel();
    await games.save(game);
  }
}
