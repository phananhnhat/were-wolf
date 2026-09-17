import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game as GameOrmEntity } from './game.orm-entity';
import { Game } from '../../domain/entities/game.entity';
import { GameId } from '../../domain/value-objects/game-id.vo';
import { GameStatus } from '../../domain/enums/game-status.enum';
import { GameRepository } from '../../domain/repositories/game.repository';

// Gateway (Interface Adapter) — implement GameRepository bằng TypeORM, dùng entity ORM
// `./game.orm-entity.ts` cùng thư mục (đã đổi tên từ `game.entity.ts` cũ, dọn khỏi
// src/game/entities/ — xem CLEAN-ARCHITECTURE.md).
//
// Domain enum (GameStatus/GamePhase/GameWinner ở src/game/domain/enums/) và ORM enum (khai báo
// trong chính file entity ORM) trùng giá trị chuỗi và tên thành viên — TypeScript coi 2 string
// enum như vậy là gán được cho nhau thẳng, không cần cast.
@Injectable()
export class TypeOrmGameRepository implements GameRepository {
  constructor(
    @InjectRepository(GameOrmEntity)
    private readonly repo: Repository<GameOrmEntity>,
  ) {}

  async findById(id: GameId): Promise<Game | null> {
    const row = await this.repo.findOneBy({ id: id.toNumber() });
    return row ? this.toDomain(row) : null;
  }

  async findLatestByRoomId(roomId: number): Promise<Game | null> {
    const row = await this.repo.findOne({
      where: { roomId },
      order: { startedAt: 'DESC' },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByRoomIdAndStatus(
    roomId: number,
    status: GameStatus,
  ): Promise<Game | null> {
    const row = await this.repo.findOneBy({ roomId, status });
    return row ? this.toDomain(row) : null;
  }

  async findAllByRoomIdAndStatus(
    roomId: number,
    status: GameStatus,
  ): Promise<Game[]> {
    const rows = await this.repo.find({ where: { roomId, status } });
    return rows.map((row) => this.toDomain(row));
  }

  async save(game: Game): Promise<void> {
    const wasNew = !game.hasId();
    const saved = await this.repo.save(this.repo.create(this.toOrm(game)));
    if (wasNew) {
      game.assignId(GameId.of(saved.id));
    }
  }

  private toDomain(row: GameOrmEntity): Game {
    return Game.reconstitute({
      id: GameId.of(row.id),
      roomId: row.roomId,
      status: row.status,
      phase: row.phase,
      dayNumber: row.dayNumber,
      phaseEndsAt: row.phaseEndsAt,
      winner: row.winner,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
    });
  }

  private toOrm(game: Game): Partial<GameOrmEntity> {
    return {
      id: game.hasId() ? game.id.toNumber() : undefined,
      roomId: game.roomId,
      status: game.status,
      phase: game.phase,
      dayNumber: game.dayNumber,
      phaseEndsAt: game.phaseEndsAt,
      winner: game.winner,
      finishedAt: game.finishedAt,
    };
  }
}
