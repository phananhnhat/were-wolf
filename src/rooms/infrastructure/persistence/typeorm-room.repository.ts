import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Room as RoomOrmEntity } from '../../entities/room.entity';
import { Room } from '../../domain/entities/room.entity';
import { RoomId } from '../../domain/value-objects/room-id.vo';
import { RoomCode } from '../../domain/value-objects/room-code.vo';
import { RoomStatus } from '../../domain/enums/room-status.enum';
import {
  RoomRepository,
  WaitingRoomsPage,
} from '../../domain/repositories/room.repository';
import { RoomCodeCollisionError } from '../../domain/errors/room-code-collision.error';

@Injectable()
export class TypeOrmRoomRepository implements RoomRepository {
  constructor(
    @InjectRepository(RoomOrmEntity)
    private readonly repo: Repository<RoomOrmEntity>,
  ) {}

  async findById(id: RoomId): Promise<Room | null> {
    const row = await this.repo.findOneBy({ id: id.toNumber() });
    return row ? this.toDomain(row) : null;
  }

  async findByCodeForUpdate(code: RoomCode): Promise<Room | null> {
    const row = await this.repo.findOne({
      where: { code: code.toString() },
      lock: { mode: 'pessimistic_write' },
    });
    return row ? this.toDomain(row) : null;
  }

  async findWaiting(page: number, limit: number): Promise<WaitingRoomsPage> {
    const [rows, total] = await this.repo.findAndCount({
      where: { status: RoomStatus.WAITING },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items: rows.map((r) => this.toDomain(r)), total };
  }

  async findAllPlayingUpdatedBefore(cutoff: Date): Promise<Room[]> {
    const rows = await this.repo.find({
      where: { status: RoomStatus.PLAYING, updatedAt: LessThan(cutoff) },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async save(room: Room): Promise<void> {
    const wasNew = !room.hasId();
    try {
      const saved = await this.repo.save(this.repo.create(this.toOrm(room)));
      if (wasNew) {
        room.assignId(RoomId.of(saved.id));
      }
    } catch (err) {
      if (wasNew && this.isUniqueViolation(err)) {
        throw new RoomCodeCollisionError();
      }
      throw err;
    }
  }

  async delete(room: Room): Promise<void> {
    await this.repo.delete(room.id.toNumber()); // cascade xoá room_members (FK onDelete CASCADE)
  }

  private isUniqueViolation(err: unknown): boolean {
    return (err as { code?: string })?.code === '23505';
  }

  private toDomain(row: RoomOrmEntity): Room {
    return Room.reconstitute({
      id: RoomId.of(row.id),
      code: RoomCode.of(row.code),
      hostId: row.hostId,
      status: row.status,
      maxPlayers: row.maxPlayers,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  private toOrm(room: Room): Partial<RoomOrmEntity> {
    return {
      id: room.hasId() ? room.id.toNumber() : undefined,
      code: room.code.toString(),
      hostId: room.hostId,
      status: room.status,
      maxPlayers: room.maxPlayers,
    };
  }
}
