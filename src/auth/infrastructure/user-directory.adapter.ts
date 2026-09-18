import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY } from '../../users/domain/repositories/user.repository';
import type { UserRepository } from '../../users/domain/repositories/user.repository';
import { User } from '../../users/domain/entities/user.entity';
import { UserId } from '../../users/domain/value-objects/user-id.vo';
import type {
  AuthUserRecord,
  NewUserInput,
  UserDirectory,
} from '../application/ports/user-directory';

// Adapter — nơi DUY NHẤT trong AuthModule được phép biết UsersModule tồn tại (Infrastructure
// layer, giống TypeOrmGameStatusReader bên RoomsModule biết GameModule). Domain/Application của
// AuthModule chỉ làm việc với UserDirectory (port của chính AuthModule), không đụng tới
// UserRepository/User domain entity của UsersModule.
@Injectable()
export class TypeOrmUserDirectory implements UserDirectory {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  private toRecord(user: User): AuthUserRecord {
    return {
      id: user.id.toNumber(),
      username: user.username,
      passwordHash: user.passwordHash,
    };
  }

  async findByUsername(username: string): Promise<AuthUserRecord | null> {
    const user = await this.users.findByUsername(username);
    return user ? this.toRecord(user) : null;
  }

  async findByEmail(email: string): Promise<AuthUserRecord | null> {
    const user = await this.users.findByEmail(email);
    return user ? this.toRecord(user) : null;
  }

  async findById(id: number): Promise<AuthUserRecord | null> {
    const user = await this.users.findById(UserId.of(id));
    return user ? this.toRecord(user) : null;
  }

  async create(input: NewUserInput): Promise<void> {
    await this.users.save(User.register(input));
  }

  async updatePasswordHash(id: number, passwordHash: string): Promise<void> {
    const user = await this.users.findById(UserId.of(id));
    if (!user) return; // gọi sau khi findById đã xác nhận tồn tại — nhánh này không nên xảy ra
    user.changePasswordHash(passwordHash);
    await this.users.save(user);
  }
}
