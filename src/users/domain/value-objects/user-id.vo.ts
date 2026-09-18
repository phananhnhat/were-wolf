// Bọc id số nguyên của User — tránh truyền nhầm id của aggregate khác vào chỗ cần UserId.
export class UserId {
  private constructor(private readonly value: number) {}

  static of(value: number): UserId {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`UserId không hợp lệ: ${value}`);
    }
    return new UserId(value);
  }

  toNumber(): number {
    return this.value;
  }

  equals(other: UserId): boolean {
    return this.value === other.value;
  }
}
