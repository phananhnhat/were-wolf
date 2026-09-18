import { UserRepository } from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';

export function findUserByEmail(
  users: UserRepository,
  email: string,
): Promise<User | null> {
  return users.findByEmail(email);
}
