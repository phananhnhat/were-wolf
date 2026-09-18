import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY } from './domain/repositories/user.repository';
import type { UserRepository } from './domain/repositories/user.repository';
import type { User } from './domain/entities/user.entity';
import { findAllUsers } from './application/use-cases/find-all-users.use-case';
import { findUserById } from './application/use-cases/find-user-by-id.use-case';
import { findUserByUsername } from './application/use-cases/find-user-by-username.use-case';
import { findUserByEmail } from './application/use-cases/find-user-by-email.use-case';
import { updateUserProfile } from './application/use-cases/update-user-profile.use-case';
import { removeUser } from './application/use-cases/remove-user.use-case';
import { UpdateUserDto } from './dto/update-user.dto';

export interface UserResponseDto {
  id: number;
  name: string;
  username: string;
  email: string;
  address: string | null;
  gender: string | null;
  createdAt: Date;
}

// Facade (Interface Adapter) — nơi UsersController và AuthModule (qua findUserById import
// trực tiếp, không qua Facade này) gọi vào. Facade là nơi DUY NHẤT ánh xạ domain User (có
// passwordHash) sang UserResponseDto (không có) trước khi trả ra ngoài HTTP — tương đương vai
// trò "Presenter" trong Clean Architecture. findUserById (Application) vẫn trả domain User đầy
// đủ cho nơi khác dùng nội bộ (vd. AuthModule cần passwordHash để so mật khẩu).
@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  async findAll(): Promise<UserResponseDto[]> {
    const rows = await findAllUsers(this.users);
    return rows.map((u) => this.toResponse(u));
  }

  async findOne(id: number): Promise<UserResponseDto> {
    const user = await findUserById(this.users, id);
    return this.toResponse(user);
  }

  async update(
    actorId: number,
    id: number,
    dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await updateUserProfile(this.users, actorId, id, dto.name);
    return this.toResponse(user);
  }

  async remove(id: number): Promise<UserResponseDto> {
    const user = await removeUser(this.users, id);
    return this.toResponse(user);
  }

  private toResponse(user: User): UserResponseDto {
    return {
      id: user.id.toNumber(),
      name: user.name,
      username: user.username,
      email: user.email,
      address: user.address,
      gender: user.gender,
      createdAt: user.createdAt,
    };
  }
}

// Dùng lại trực tiếp bởi AuthModule (JwtStrategy, registerUser, changeUserPassword, ...) —
// export riêng để nơi khác import HÀM, không phải qua Facade (Facade chỉ phục vụ Controller).
export { findUserByUsername, findUserByEmail };
