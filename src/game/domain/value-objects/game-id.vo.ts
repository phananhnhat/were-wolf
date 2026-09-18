import { NumericId, assertPositiveInteger } from '../../../common/numeric-id';

// Bọc id số nguyên của Game lại thành kiểu riêng — tránh truyền nhầm id của aggregate khác
// (roomId, userId...) vào chỗ cần GameId, lỗi lộ ra ngay lúc compile.
export class GameId extends NumericId<GameId> {
  static of(value: number): GameId {
    assertPositiveInteger(value, 'GameId');
    return new GameId(value);
  }
}
