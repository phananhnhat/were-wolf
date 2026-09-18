import { RoomRepository } from '../../domain/repositories/room.repository';
import { GameStatusReader } from '../ports/game-status-reader';
import { Logger } from '../ports/logger';
import { finishGame } from './finish-game.use-case';

// Phòng phải PLAYING quá khoảng này mới bị coi là khả nghi — tránh đá vào phòng vừa startGame()
// xong nhưng transaction tạo Game (ở GameModule) chưa kịp commit.
const STUCK_ROOM_GRACE_MS = 30_000;

// Lưới an toàn cuối cùng: nếu handleGameFinished()/handleGameStartFailed() từng chạy thất bại
// giữa chừng (event 'game.finished'/'game.start_failed' bắn ra nhưng handler lỗi, hoặc process
// crash trước khi kịp xử lý), Room có thể kẹt ở PLAYING vĩnh viễn dù chẳng còn ván nào đang
// chạy. Job này quét định kỳ và TỰ CHUYỂN những phòng như vậy về WAITING — không cần biết lỗi cụ
// thể là gì, chỉ cần "PLAYING mà không có ván IN_PROGRESS nào" là đủ điều kiện tự phục hồi.
export async function reconcileStuckRooms(
  rooms: RoomRepository,
  gameStatusReader: GameStatusReader,
  logger: Logger,
): Promise<void> {
  const cutoff = new Date(Date.now() - STUCK_ROOM_GRACE_MS);
  const playingRooms = await rooms.findAllPlayingUpdatedBefore(cutoff);

  for (const room of playingRooms) {
    const hasActiveGame = await gameStatusReader.hasActiveGame(
      room.id.toNumber(),
    );
    if (hasActiveGame) continue;

    logger.warn(
      `Room #${room.id.toNumber()} kẹt ở PLAYING nhưng không có ván nào đang chạy — tự phục hồi về WAITING`,
    );
    await finishGame(rooms, room.id.toNumber());
  }
}
