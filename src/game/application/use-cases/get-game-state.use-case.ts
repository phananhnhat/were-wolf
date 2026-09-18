import { GameRepository } from '../../domain/repositories/game.repository';
import { GamePlayerRepository } from '../../domain/repositories/game-player.repository';
import { PlayerId } from '../../domain/value-objects/player-id.vo';
import { PlayerNotInGameError } from '../../domain/errors/player-not-in-game.error';
import {
  GameStateView,
  toGameStateView,
} from '../read-models/game-state.read-model';

export interface GameStateOutput {
  game: GameStateView | null;
}

// Trạng thái ván. Cố ý **không phụ thuộc người xem**: hai người trong cùng một ván gọi lên sẽ
// nhận phản hồi y hệt nhau. Mọi thứ riêng tư (vai của mình, đồng đội Sói, kỹ năng) nằm ở
// getMyState. Nhờ tách như vậy, việc rà soát rò rỉ bí mật chỉ gói gọn ở một chỗ. Xem
// docs/game.md §9.2.
export async function getGameState(
  games: GameRepository,
  players: GamePlayerRepository,
  roomId: number,
  userId: number,
): Promise<GameStateOutput> {
  const game = await games.findLatestByRoomId(roomId);
  // Phòng chưa chơi ván nào không phải lỗi — đó là trạng thái bình thường của phòng đang chờ.
  // Trả { game: null }.
  if (!game) return { game: null };

  const roster = await players.findByGameId(game.id);
  const userPid = PlayerId.of(userId);
  if (!roster.some((p) => p.isOwnedBy(userPid))) {
    throw new PlayerNotInGameError();
  }

  return { game: toGameStateView(game, roster) };
}
