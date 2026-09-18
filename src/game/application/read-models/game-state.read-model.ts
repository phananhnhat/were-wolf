import { Game } from '../../domain/entities/game.entity';
import { GamePlayer } from '../../domain/entities/game-player.entity';
import { GameStatus } from '../../domain/enums/game-status.enum';
import { GamePhase } from '../../domain/enums/game-phase.enum';
import { GameWinner } from '../../domain/enums/game-winner.enum';

export interface GameStateView {
  id: number;
  roomId: number;
  status: GameStatus;
  phase: GamePhase;
  dayNumber: number;
  phaseEndsAt: Date | null;
  winner: GameWinner | null;
  players: Array<{ userId: number; isAlive: boolean; role: string | null }>;
}

// Trạng thái ván — giống hệt nhau với mọi người xem, không chứa gì riêng tư. Tách khỏi
// getGameState (vốn còn kiểm tra "người gọi có phải thành viên ván không" cho ĐÚNG 1 người) để
// chỗ BROADCAST qua MQTT (advanceGame/startGame — không gắn với 1 user cụ thể, quyền xem đã
// được broker kiểm ở bước SUBSCRIBE rồi) gọi thẳng được, không phải giả một userId để né
// PlayerNotInGameError. Xem PLAN-REALTIME.md mục 6.
export function toGameStateView(
  game: Game,
  roster: GamePlayer[],
): GameStateView {
  const isFinished = !game.isInProgress();
  return {
    id: game.id.toNumber(),
    roomId: game.roomId,
    status: game.status,
    phase: game.phase,
    dayNumber: game.dayNumber,
    phaseEndsAt: game.phaseEndsAt,
    winner: game.winner,
    // Lộ vai khi CHÍNH NGƯỜI ĐÓ đã chết, hoặc khi ván đã kết thúc — và lộ cho tất cả mọi người
    // như nhau. Người xem đã chết KHÔNG vì thế mà thấy được vai của người còn sống.
    players: roster.map((p) => ({
      userId: p.userId.toNumber(),
      isAlive: p.isAlive,
      role: !p.isAlive || isFinished ? p.role.toKey() : null,
    })),
  };
}
