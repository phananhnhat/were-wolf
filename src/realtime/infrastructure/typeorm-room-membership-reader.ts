import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomMember as RoomMemberOrmEntity } from '../../rooms/entities/room-member.entity';
import { RoomMembershipReader } from '../application/ports/room-membership-reader';

// Gateway — đọc thẳng bảng `room_members` của RoomsModule (chỉ Infrastructure layer của
// RealtimeModule được phép biết RoomsModule tồn tại, xem room-membership-reader.ts port) —
// cùng cách TypeOrmGameStatusReader của RoomsModule tự đọc thẳng bảng `games` của GameModule.
@Injectable()
export class TypeOrmRoomMembershipReader implements RoomMembershipReader {
  constructor(
    @InjectRepository(RoomMemberOrmEntity)
    private readonly repo: Repository<RoomMemberOrmEntity>,
  ) {}

  async isRoomMember(userId: number, roomId: number): Promise<boolean> {
    const row = await this.repo.findOneBy({ roomId, userId });
    return row !== null;
  }
}
