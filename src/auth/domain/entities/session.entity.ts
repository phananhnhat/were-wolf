import { SessionId } from '../value-objects/session-id.vo';

// Một refresh session — bất biến (không có method sửa): hết hạn hay bị thu hồi thì xoá hẳn
// dòng, không update. `tokenHash` là refresh token ĐÃ HASH (PasswordHasher hash trước khi ghi),
// giống cách `password` của User thực chất lưu hash chứ không phải giá trị gốc.
export class Session {
  private constructor(
    readonly id: SessionId,
    readonly userId: number,
    readonly tokenHash: string,
    readonly expiresAt: Date,
    readonly createdAt: Date,
  ) {}

  static create(props: {
    id: SessionId;
    userId: number;
    tokenHash: string;
    expiresAt: Date;
  }): Session {
    return new Session(
      props.id,
      props.userId,
      props.tokenHash,
      props.expiresAt,
      new Date(),
    );
  }

  static reconstitute(props: {
    id: SessionId;
    userId: number;
    tokenHash: string;
    expiresAt: Date;
    createdAt: Date;
  }): Session {
    return new Session(
      props.id,
      props.userId,
      props.tokenHash,
      props.expiresAt,
      props.createdAt,
    );
  }

  isExpired(now: Date): boolean {
    return this.expiresAt < now;
  }
}
