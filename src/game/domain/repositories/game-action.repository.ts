import { GameAction } from '../entities/game-action.entity';
import { GameId } from '../value-objects/game-id.vo';
import { PlayerId } from '../value-objects/player-id.vo';
import { GameActionType } from '../enums/game-action-type.enum';

export const GAME_ACTION_REPOSITORY = Symbol('GAME_ACTION_REPOSITORY');

export interface GameActionRepository {
  // Bản ghi của MỘT NGƯỜI trong MỘT LƯỢT cụ thể — luật "mỗi đêm 1 lần" (Tiên tri, Bảo vệ).
  findOneByActorAndDay(
    gameId: GameId,
    dayNumber: number,
    actionType: GameActionType,
    actorId: PlayerId,
  ): Promise<GameAction | null>;

  // Bản ghi của MỘT NGƯỜI trong CẢ VÁN, không quan tâm lượt nào — luật "1 lần cả ván" (2 bình
  // thuốc Phù thuỷ). Xem docs/impl-phu-thuy.md §2.2.
  findOneByActorThisGame(
    gameId: GameId,
    actorId: PlayerId,
    actionType: GameActionType,
  ): Promise<GameAction | null>;

  // Bản ghi của MỘT LƯỢT, không quan tâm ai thực hiện — dùng khi áp dụng cái chết đêm
  // (chỉ cần biết "có ai cứu/độc đêm nay không", không cần biết là ai).
  findOneOfTypeThisTurn(
    gameId: GameId,
    dayNumber: number,
    actionType: GameActionType,
  ): Promise<GameAction | null>;

  // Toàn bộ lịch sử của một người, có thể nhiều loại action (vd. Phù thuỷ: cả heal lẫn
  // poison). HỢP ĐỒNG: kết quả sắp theo dayNumber tăng dần — các use case lịch sử (Seer,
  // Guardian, Witch) không tự sort lại.
  findAllByActor(
    gameId: GameId,
    actorId: PlayerId,
    actionTypes: GameActionType[],
  ): Promise<GameAction[]>;

  // Append-only: chèn 1 dòng mới. HỢP ĐỒNG: nếu vi phạm UNIQUE constraint (đã dùng rồi — tầng
  // chặn thứ 2, sau khi use case đã tự kiểm tra tầng 1 bằng findOneByActorAndDay/
  // findOneByActorThisGame), implementation PHẢI ném lại SkillAlreadyUsedError — domain layer
  // không biết mã lỗi Postgres 23505, nên việc dịch mã lỗi là của implementation, không phải
  // của nơi gọi. Message cụ thể không quan trọng: nơi gọi (use case) sẽ tự bắt lại và ném ra
  // message chính xác theo ngữ cảnh của nó.
  record(action: GameAction): Promise<void>;
}
