import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSession as UserSessionOrmEntity } from '../../entities/user-session.entity';
import { Session } from '../../domain/entities/session.entity';
import { SessionId } from '../../domain/value-objects/session-id.vo';
import { SessionRepository } from '../../domain/repositories/session.repository';

@Injectable()
export class TypeOrmSessionRepository implements SessionRepository {
  constructor(
    @InjectRepository(UserSessionOrmEntity)
    private readonly repo: Repository<UserSessionOrmEntity>,
  ) {}

  async findByIdAndUser(id: string, userId: number): Promise<Session | null> {
    const row = await this.repo.findOneBy({ id, userId });
    return row ? this.toDomain(row) : null;
  }

  async save(session: Session): Promise<void> {
    await this.repo.save(
      this.repo.create({
        id: session.id.toString(),
        userId: session.userId,
        tokenHash: session.tokenHash,
        expiresAt: session.expiresAt,
      }),
    );
  }

  async deleteById(id: string, userId: number): Promise<void> {
    await this.repo.delete({ id, userId });
  }

  async deleteAllForUser(userId: number): Promise<void> {
    await this.repo.delete({ userId });
  }

  private toDomain(row: UserSessionOrmEntity): Session {
    return Session.reconstitute({
      id: SessionId.of(row.id),
      userId: row.userId,
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    });
  }
}
