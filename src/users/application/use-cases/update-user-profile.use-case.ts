import { UserRepository } from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';
import { UserId } from '../../domain/value-objects/user-id.vo';
import { UserNotFoundError } from '../../domain/errors/user-not-found.error';
import { ForbiddenProfileEditError } from '../../domain/errors/forbidden-profile-edit.error';

// Chỉ chính chủ mới được sửa hồ sơ của mình. `actorId` lấy từ access token (Interface layer),
// không phải từ param — client không tự khai được. Cố ý kiểm tra actorId === id TRƯỚC khi tra
// DB (giống hành vi gốc): người không phải chủ hồ sơ luôn nhận Forbidden, kể cả khi `id` không
// tồn tại — tránh lộ thông tin "id này có tồn tại hay không" cho người không có quyền.
export async function updateUserProfile(
  users: UserRepository,
  actorId: number,
  id: number,
  name: string | undefined,
): Promise<User> {
  if (actorId !== id) {
    throw new ForbiddenProfileEditError();
  }

  const user = await users.findById(UserId.of(id));
  if (!user) throw new UserNotFoundError(id);

  // `name` optional — không gửi lên thì giữ nguyên tên cũ, giống Object.assign(user, dto) gốc
  // (chỉ ghi đè field nào thật sự có mặt trong body).
  if (name !== undefined) {
    user.updateName(name);
    await users.save(user);
  }
  return user;
}
