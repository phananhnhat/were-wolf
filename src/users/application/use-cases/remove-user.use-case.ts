import { UserRepository } from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';
import { UserId } from '../../domain/value-objects/user-id.vo';
import { UserNotFoundError } from '../../domain/errors/user-not-found.error';

export async function removeUser(
  users: UserRepository,
  id: number,
): Promise<User> {
  const user = await users.findById(UserId.of(id));
  if (!user) throw new UserNotFoundError(id);

  await users.remove(user);
  return user;
}
