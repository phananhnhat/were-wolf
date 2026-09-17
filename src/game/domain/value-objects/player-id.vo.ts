// Id của User trong ngữ cảnh một ván chơi. Game domain định nghĩa kiểu riêng của mình thay vì
// phụ thuộc vào UserId của Users context — mỗi bounded context tự chủ kiểu id nó cần.
export class PlayerId {
  private constructor(private readonly value: number) {}

  static of(value: number): PlayerId {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`PlayerId không hợp lệ: ${value}`);
    }
    return new PlayerId(value);
  }

  toNumber(): number {
    return this.value;
  }

  equals(other: PlayerId): boolean {
    return this.value === other.value;
  }
}
