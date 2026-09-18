import { User } from '../entities/user.entity';
import { UserId } from '../value-objects/user-id.vo';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserRepository {
  findAll(): Promise<User[]>;
  findById(id: UserId): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;

  // Hợp đồng: với User chưa có id (mới), implementation phải INSERT rồi gọi user.assignId(...)
  // trước khi Promise resolve — giống hợp đồng save() của GameRepository ở GameModule.
  save(user: User): Promise<void>;

  remove(user: User): Promise<void>;
}
