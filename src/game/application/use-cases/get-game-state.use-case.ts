import { GameRepository } from '../../domain/repositories/game.repository';
import { GamePlayerRepository } from '../../domain/repositories/game-player.repository';
import { PlayerId } from '../../domain/value-objects/player-id.vo';
import { GameStatus } from '../../domain/enums/game-status.enum';
import { GamePhase } from '../../domain/enums/game-phase.enum';
import { GameWinner } from '../../domain/enums/game-winner.enum';
import { PlayerNotInGameError } from '../../domain/errors/player-not-in-game.error';

export const GET_GAME_STATE_USE_CASE = Symbol('GET_GAME_STATE_USE_CASE');

export interface GameStateOutput {
  game: {
    id: number;
    roomId: number;
    status: GameStatus;
    phase: GamePhase;
    dayNumber: number;
    phaseEndsAt: Date | null;
    winner: GameWinner | null;
    players: Array<{ userId: number; isAlive: boolean; role: string | null }>;
  } | null;
}

// Trạng thái ván. Cố ý **không phụ thuộc người xem**: hai người trong cùng một ván gọi lên sẽ
// nhận phản hồi y hệt nhau. Mọi thứ riêng tư (vai của mình, đồng đội Sói, kỹ năng) nằm ở
// GetMyStateUseCase. Nhờ tách như vậy, việc rà soát rò rỉ bí mật chỉ gói gọn ở một chỗ. Xem
// docs/game.md §9.2.
export class GetGameStateUseCase {
  constructor(
    private readonly games: GameRepository,
    private readonly players: GamePlayerRepository,
  ) {}

  async execute(roomId: number, userId: number): Promise<GameStateOutput> {
    const game = await this.games.findLatestByRoomId(roomId);
    // Phòng chưa chơi ván nào không phải lỗi — đó là trạng thái bình thường của phòng đang
    // chờ. Trả { game: null }.
    if (!game) return { game: null };

    const players = await this.players.findByGameId(game.id);
    const userPid = PlayerId.of(userId);
    if (!players.some((p) => p.isOwnedBy(userPid))) {
      throw new PlayerNotInGameError();
    }

    const isFinished = !game.isInProgress();

    return {
      game: {
        id: game.id.toNumber(),
        roomId: game.roomId,
        status: game.status,
        phase: game.phase,
        dayNumber: game.dayNumber,
        phaseEndsAt: game.phaseEndsAt,
        winner: game.winner,
        // Lộ vai khi CHÍNH NGƯỜI ĐÓ đã chết, hoặc khi ván đã kết thúc — và lộ cho tất cả mọi
        // người như nhau. Người xem đã chết KHÔNG vì thế mà thấy được vai của người còn sống.
        players: players.map((p) => ({
          userId: p.userId.toNumber(),
          isAlive: p.isAlive,
          role: !p.isAlive || isFinished ? p.role.toKey() : null,
        })),
      },
    };
  }
}
