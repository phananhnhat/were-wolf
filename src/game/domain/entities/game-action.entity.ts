import { PlayerId } from '../value-objects/player-id.vo';
import { GameActionType } from '../enums/game-action-type.enum';

// Một lần dùng kỹ năng của vai đặc biệt. Append-only — KHÔNG có method sửa: một khi đã ghi
// (soi, che, đầu độc, cứu) thì không đổi ý được, khác hẳn GameVote. Xem game-action.repository.ts
// cho ràng buộc "mỗi đêm 1 lần" / "cả ván 1 lần" tuỳ loại action.
export class GameAction {
  private constructor(
    readonly gameId: number,
    readonly dayNumber: number,
    readonly actionType: GameActionType,
    readonly actorId: PlayerId,
    readonly targetId: PlayerId,
    // Kết quả trả về cho người dùng kỹ năng. SEER_CHECK: 'WEREWOLF' | 'NOT_WEREWOLF'. Lưu lại
    // thay vì tính lại mỗi lần đọc, để bản ghi phản ánh đúng kết quả TẠI THỜI ĐIỂM soi.
    readonly result: string | null,
    readonly createdAt: Date,
  ) {}

  static record(props: {
    gameId: number;
    dayNumber: number;
    actionType: GameActionType;
    actorId: PlayerId;
    targetId: PlayerId;
    result?: string | null;
  }): GameAction {
    return new GameAction(
      props.gameId,
      props.dayNumber,
      props.actionType,
      props.actorId,
      props.targetId,
      props.result ?? null,
      new Date(),
    );
  }

  static reconstitute(props: {
    gameId: number;
    dayNumber: number;
    actionType: GameActionType;
    actorId: PlayerId;
    targetId: PlayerId;
    result: string | null;
    createdAt: Date;
  }): GameAction {
    return new GameAction(
      props.gameId,
      props.dayNumber,
      props.actionType,
      props.actorId,
      props.targetId,
      props.result,
      props.createdAt,
    );
  }
}
