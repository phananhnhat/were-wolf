import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  findAll(): Promise<User[]> {
    return this.repo.find();
  }

  async findOne(id: number): Promise<User> {
    const user = await this.repo.findOneBy({ id });
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return user;
  }

  findByUsername(username: string): Promise<User | null> {
    return this.repo.findOneBy({ username });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findOneBy({ email });
  }

  async create(dto: CreateUserDto): Promise<User> {
    return this.repo.save(this.repo.create(dto));
  }

  /**
   * Chỉ chính chủ mới được sửa hồ sơ của mình. `actorId` lấy từ access token
   * (`@CurrentUser()`), không phải từ body/param — client không tự khai được.
   */
  async update(actorId: number, id: number, dto: UpdateUserDto): Promise<User> {
    if (actorId !== id) {
      throw new ForbiddenException('Bạn chỉ được sửa thông tin của chính mình');
    }

    const user = await this.findOne(id);
    Object.assign(user, dto);
    return this.repo.save(user);
  }

  async updatePassword(id: number, dto: UpdatePasswordDto): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, dto);
    return this.repo.save(user);
  }

  async remove(id: number): Promise<User> {
    const user = await this.findOne(id);
    return this.repo.remove(user);
  }
}
