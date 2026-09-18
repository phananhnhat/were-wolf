import { UserRepository } from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';

export function findAllUsers(users: UserRepository): Promise<User[]> {
  return users.findAll();
}
