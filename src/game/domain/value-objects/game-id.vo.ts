// Bọc id số nguyên của Game lại thành kiểu riêng — tránh truyền nhầm id của aggregate khác
// (roomId, userId...) vào chỗ cần GameId, lỗi lộ ra ngay lúc compile thay vì lúc chạy.
export class GameId {
  private constructor(private readonly value: number) {}

  static of(value: number): GameId {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`GameId không hợp lệ: ${value}`);
    }
    return new GameId(value);
  }

  toNumber(): number {
    return this.value;
  }

  equals(other: GameId): boolean {
    return this.value === other.value;
  }
}
