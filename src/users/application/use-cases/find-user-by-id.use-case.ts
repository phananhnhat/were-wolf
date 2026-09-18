import { UserRepository } from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';
import { UserId } from '../../domain/value-objects/user-id.vo';
import { UserNotFoundError } from '../../domain/errors/user-not-found.error';

// Dùng cả bởi UsersController (qua Facade) lẫn nội bộ AuthModule (JwtStrategy,
// JwtRefreshStrategy) — trả về domain entity ĐẦY ĐỦ (gồm passwordHash). Nơi phục vụ HTTP
// (UsersService) tự map sang view an toàn trước khi trả ra ngoài, không phải việc của use case
// này.
export async function findUserById(
  users: UserRepository,
  id: number,
): Promise<User> {
  const user = await users.findById(UserId.of(id));
  if (!user) throw new UserNotFoundError(id);
  return user;
}
