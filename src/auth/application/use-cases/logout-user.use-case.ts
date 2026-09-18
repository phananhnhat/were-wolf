import { SessionRepository } from '../../domain/repositories/session.repository';
import { TokenIssuer } from '../ports/token-issuer';

// Đăng xuất 1 thiết bị: verify refresh token, chỉ xoá đúng session tương ứng (`sid`) → các
// thiết bị khác vẫn đăng nhập. Token không hợp lệ/hết hạn thì coi như không cần xoá gì — KHÔNG
// ném lỗi, luôn trả thành công (giống hành vi gốc: try/catch nuốt lỗi verify).
export async function logoutUser(
  sessions: SessionRepository,
  tokenIssuer: TokenIssuer,
  userId: number,
  rawRefreshToken: string,
): Promise<{ message: string }> {
  const payload = await tokenIssuer
    .verifyRefreshToken(rawRefreshToken)
    .catch(() => null);
  if (payload && payload.sub === userId) {
    await sessions.deleteById(payload.sid, userId);
  }
  return { message: 'Logged out successfully' };
}
