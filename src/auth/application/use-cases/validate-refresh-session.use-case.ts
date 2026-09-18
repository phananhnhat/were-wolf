import type { AuthUserRecord, UserDirectory } from '../ports/user-directory';
import type { SessionRepository } from '../../domain/repositories/session.repository';
import type { PasswordHasher } from '../ports/password-hasher';
import { InvalidRefreshSessionError } from '../../domain/errors/invalid-refresh-session.error';

// Dời nguyên logic trước đây nằm trong JwtRefreshStrategy.validate(): tra session, kiểm tra
// hạn, so refresh token với hash đã lưu, rồi tra user. Cố ý gọi `users.findById()` thẳng thay vì
// phân biệt lỗi — user không tồn tại cũng chỉ báo InvalidRefreshSessionError giống mọi lỗi khác
// ở đây (không phân biệt "session sai" với "user không tồn tại" để tránh lộ thông tin), đúng
// hành vi gốc (luôn ném UnauthorizedException).
export async function validateRefreshSession(
  users: UserDirectory,
  sessions: SessionRepository,
  hasher: PasswordHasher,
  userId: number,
  sessionId: string,
  rawToken: string,
): Promise<AuthUserRecord> {
  const session = await sessions.findByIdAndUser(sessionId, userId);
  if (!session) throw new InvalidRefreshSessionError();

  if (session.isExpired(new Date())) throw new InvalidRefreshSessionError();

  const matches = await hasher.compare(rawToken, session.tokenHash);
  if (!matches) throw new InvalidRefreshSessionError();

  const user = await users.findById(userId);
  if (!user) throw new InvalidRefreshSessionError();

  return user;
}
