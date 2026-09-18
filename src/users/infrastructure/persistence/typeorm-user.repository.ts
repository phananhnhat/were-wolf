import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User as UserOrmEntity } from '../../entities/user.entity';
import { User } from '../../domain/entities/user.entity';
import { UserId } from '../../domain/value-objects/user-id.vo';
import { UserRepository } from '../../domain/repositories/user.repository';

// Gateway (Interface Adapter) — implement UserRepository bằng TypeORM. Dùng nguyên TypeORM
// entity hiện có ở src/users/entities/user.entity.ts (chưa đổi tên/di chuyển — nợ kỹ thuật ghi
// ở CLEAN-ARCHITECTURE.md, giống GameModule ở lượt đầu). Cột `password` của ORM thực chất lưu
// giá trị ĐÃ HASH (AuthModule hash trước khi ghi) — domain gọi đúng tên là `passwordHash`.
@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly repo: Repository<UserOrmEntity>,
  ) {}

  async findAll(): Promise<User[]> {
    const rows = await this.repo.find();
    return rows.map((row) => this.toDomain(row));
  }

  async findById(id: UserId): Promise<User | null> {
    const row = await this.repo.findOneBy({ id: id.toNumber() });
    return row ? this.toDomain(row) : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const row = await this.repo.findOneBy({ username });
    return row ? this.toDomain(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.repo.findOneBy({ email });
    return row ? this.toDomain(row) : null;
  }

  async save(user: User): Promise<void> {
    const wasNew = !user.hasId();
    const saved = await this.repo.save(this.repo.create(this.toOrm(user)));
    if (wasNew) {
      user.assignId(UserId.of(saved.id));
    }
  }

  async remove(user: User): Promise<void> {
    await this.repo.delete(user.id.toNumber());
  }

  private toDomain(row: UserOrmEntity): User {
    return User.reconstitute({
      id: UserId.of(row.id),
      name: row.name,
      username: row.username,
      email: row.email,
      address: row.address,
      gender: row.gender,
      passwordHash: row.password,
      createdAt: row.createdAt,
    });
  }

  private toOrm(user: User): Partial<UserOrmEntity> {
    return {
      id: user.hasId() ? user.id.toNumber() : undefined,
      name: user.name,
      username: user.username,
      email: user.email,
      address: user.address,
      gender: user.gender,
      password: user.passwordHash,
    };
  }
}
