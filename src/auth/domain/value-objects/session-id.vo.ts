import { randomUUID } from 'crypto';

// Id của một refresh session — uuid do client (server) tự sinh lúc tạo, khác GameId/UserId
// (autoincrement của Postgres): Session luôn có id ngay từ lúc khởi tạo, không cần
// hasId()/assignId() như các aggregate autoincrement khác.
export class SessionId {
  private constructor(private readonly value: string) {}

  static generate(): SessionId {
    return new SessionId(randomUUID());
  }

  static of(value: string): SessionId {
    if (!value) throw new Error('SessionId không hợp lệ');
    return new SessionId(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: SessionId): boolean {
    return this.value === other.value;
  }
}
