import type { UserDirectory } from '../ports/user-directory';
import type { SessionRepository } from '../../domain/repositories/session.repository';
import type { PasswordHasher } from '../ports/password-hasher';
import { IncorrectPasswordError } from '../../domain/errors/incorrect-password.error';
import { AuthUserNotFoundError } from '../../domain/errors/auth-user-not-found.error';

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

// Đối chiếu mật khẩu hiện tại, đổi sang mật khẩu mới, rồi đăng xuất TOÀN BỘ thiết bị (xoá hết
// session của user) — giống hành vi gốc.
export async function changeUserPassword(
  users: UserDirectory,
  sessions: SessionRepository,
  hasher: PasswordHasher,
  userId: number,
  input: ChangePasswordInput,
): Promise<{ message: string }> {
  const user = await users.findById(userId);
  if (!user) throw new AuthUserNotFoundError(userId);

  const valid = await hasher.compare(input.currentPassword, user.passwordHash);
  if (!valid) throw new IncorrectPasswordError();

  await users.updatePasswordHash(userId, await hasher.hash(input.newPassword));
  await sessions.deleteAllForUser(userId);

  return { message: 'Password changed successfully' };
}
