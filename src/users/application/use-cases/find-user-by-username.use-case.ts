import { UserRepository } from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';

export function findUserByUsername(
  users: UserRepository,
  username: string,
): Promise<User | null> {
  return users.findByUsername(username);
}
