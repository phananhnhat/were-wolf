import { AuthDomainError } from './auth-domain.error';

// Lỗi CỦA AuthModule (không phải UserNotFoundError của UsersModule) — ném ra khi UserDirectory
// không tìm thấy user, để AuthController không phải gắn thêm UserDomainExceptionFilter chỉ vì
// 1 use case này.
export class AuthUserNotFoundError extends AuthDomainError {
  constructor(id: number) {
    super('NOT_FOUND', `User #${id} not found`);
  }
}
