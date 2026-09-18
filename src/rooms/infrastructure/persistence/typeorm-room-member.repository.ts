import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomMember as RoomMemberOrmEntity } from '../../entities/room-member.entity';
import { RoomMember } from '../../domain/entities/room-member.entity';
import {
  RoomMemberRepository,
  RoomMemberWithUser,
} from '../../domain/repositories/room-member.repository';

@Injectable()
export class TypeOrmRoomMemberRepository implements RoomMemberRepository {
  constructor(
    @InjectRepository(RoomMemberOrmEntity)
    private readonly repo: Repository<RoomMemberOrmEntity>,
  ) {}

  async findByRoomId(roomId: number): Promise<RoomMember[]> {
    const rows = await this.repo.find({
      where: { roomId },
      order: { joinedAt: 'ASC' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findByRoomAndUser(
    roomId: number,
    userId: number,
  ): Promise<RoomMember | null> {
    const row = await this.repo.findOneBy({ roomId, userId });
    return row ? this.toDomain(row) : null;
  }

  async findByRoomIdWithUser(roomId: number): Promise<RoomMemberWithUser[]> {
    const rows = await this.repo.find({
      where: { roomId },
      relations: { user: true },
      order: { joinedAt: 'ASC' },
    });
    return rows.map((r) => ({
      id: r.id,
      roomId: r.roomId,
      userId: r.userId,
      isHost: r.isHost,
      joinedAt: r.joinedAt,
      user: {
        id: r.user.id,
        name: r.user.name,
        username: r.user.username,
        email: r.user.email,
        address: r.user.address,
        gender: r.user.gender,
        createdAt: r.user.createdAt,
      },
    }));
  }

  async findByUserId(userId: number): Promise<RoomMember | null> {
    const row = await this.repo.findOneBy({ userId });
    return row ? this.toDomain(row) : null;
  }

  countByRoomId(roomId: number): Promise<number> {
    return this.repo.count({ where: { roomId } });
  }

  // RoomMember domain không giữ id tự tăng — tự tra id hiện có theo khoá tự nhiên
  // (roomId, userId) trước khi ghi, để cập nhật đúng dòng thay vì tạo dòng mới. Cùng lý do/
  // đánh đổi như TypeOrmGamePlayerRepository ở GameModule.
  async save(member: RoomMember): Promise<void> {
    const existing = await this.repo.findOneBy({
      roomId: member.roomId,
      userId: member.userId,
    });
    await this.repo.save(
      this.repo.create({
        id: existing?.id,
        roomId: member.roomId,
        userId: member.userId,
        isHost: member.isHost,
        joinedAt: member.joinedAt,
      }),
    );
  }

  async delete(member: RoomMember): Promise<void> {
    await this.repo.delete({ roomId: member.roomId, userId: member.userId });
  }

  private toDomain(row: RoomMemberOrmEntity): RoomMember {
    return RoomMember.reconstitute({
      roomId: row.roomId,
      userId: row.userId,
      isHost: row.isHost,
      joinedAt: row.joinedAt,
    });
  }
}
