import { GamePlayer } from '../entities/game-player.entity';
import { GameId } from '../value-objects/game-id.vo';
import { PlayerId } from '../value-objects/player-id.vo';

export const GAME_PLAYER_REPOSITORY = Symbol('GAME_PLAYER_REPOSITORY');

export interface GamePlayerRepository {
  findByGameId(gameId: GameId): Promise<GamePlayer[]>;

  findByGameAndUser(
    gameId: GameId,
    userId: PlayerId,
  ): Promise<GamePlayer | null>;

  // Chia vai lúc bắt đầu ván — ghi cả danh sách trong 1 lần.
  saveMany(players: GamePlayer[]): Promise<void>;

  // Cập nhật 1 người chơi (vd. sau resolveLynch()/resolveDeaths() đánh dấu isAlive = false).
  save(player: GamePlayer): Promise<void>;
}
