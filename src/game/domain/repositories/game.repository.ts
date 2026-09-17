import { Game } from '../entities/game.entity';
import { GameId } from '../value-objects/game-id.vo';
import { GameStatus } from '../enums/game-status.enum';

// Token DI cho interface này — interface biến mất lúc runtime nên NestJS cần token tường minh
// để biết bind adapter nào vào đâu (xem Infrastructure layer, bước nối dây).
export const GAME_REPOSITORY = Symbol('GAME_REPOSITORY');

// PORT — chỉ khai báo hợp đồng, chưa có implementation. Infrastructure layer (TypeORM
// adapter) sẽ implement interface này ở bước sau; Application layer (use case) chỉ phụ thuộc
// vào interface này, không biết TypeORM tồn tại.
export interface GameRepository {
  findById(id: GameId): Promise<Game | null>;

  // Ván mới nhất của một phòng, bất kể trạng thái — dùng cho getGameState() (endpoint KHÔNG
  // phụ thuộc người xem, xem docs/game.md §9.2).
  findLatestByRoomId(roomId: number): Promise<Game | null>;

  findByRoomIdAndStatus(
    roomId: number,
    status: GameStatus,
  ): Promise<Game | null>;

  findAllByRoomIdAndStatus(roomId: number, status: GameStatus): Promise<Game[]>;

  save(game: Game): Promise<void>;
}
