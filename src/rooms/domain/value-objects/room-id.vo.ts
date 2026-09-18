export class RoomId {
  private constructor(private readonly value: number) {}

  static of(value: number): RoomId {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`RoomId không hợp lệ: ${value}`);
    }
    return new RoomId(value);
  }

  toNumber(): number {
    return this.value;
  }

  equals(other: RoomId): boolean {
    return this.value === other.value;
  }
}
