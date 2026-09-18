import { AuthDomainError } from './auth-domain.error';

// Dùng nội bộ bởi validateRefreshSession() — không đi qua AuthDomainExceptionFilter vì đường
// refresh token chạy qua JwtRefreshStrategy (Passport Guard), không qua
// Controller→AuthService→filter như các lỗi khác. JwtRefreshStrategy tự bắt lỗi này và ném lại
// UnauthorizedException, giống hành vi gốc (throw new UnauthorizedException() thẳng trong
// validate()).
export class InvalidRefreshSessionError extends AuthDomainError {
  constructor() {
    super('UNAUTHORIZED', 'Invalid refresh session');
  }
}
