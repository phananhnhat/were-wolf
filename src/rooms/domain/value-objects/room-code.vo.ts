// Bảng chữ sinh mã phòng — bỏ ký tự dễ nhầm: 0/O, 1/I
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LENGTH = 6;

export class RoomCode {
  private constructor(private readonly value: string) {}

  static of(value: string): RoomCode {
    const normalized = value.toUpperCase();
    if (normalized.length !== CODE_LENGTH) {
      throw new Error(`RoomCode không hợp lệ: ${value}`);
    }
    return new RoomCode(normalized);
  }

  // Sinh ngẫu nhiên — KHÔNG đảm bảo duy nhất (đó là việc của tầng lưu trữ: thử insert, đụng
  // UNIQUE thì gọi lại hàm này). Thuần trong bộ nhớ, không I/O, giống cách RoleAssignmentService
  // dùng Math.random ở GameModule.
  static generateRandom(): RoomCode {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    return new RoomCode(code);
  }

  toString(): string {
    return this.value;
  }

  equals(other: RoomCode): boolean {
    return this.value === other.value;
  }
}
