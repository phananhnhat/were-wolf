import { RoomRepository } from '../../domain/repositories/room.repository';
import {
  RoomMemberRepository,
  RoomMemberWithUser,
} from '../../domain/repositories/room-member.repository';
import { Room } from '../../domain/entities/room.entity';
import { RoomId } from '../../domain/value-objects/room-id.vo';
import { RoomNotFoundError } from '../../domain/errors/room-not-found.error';
import { NotRoomMemberError } from '../../domain/errors/not-room-member.error';

export interface RoomDetailOutput {
  room: Room;
  members: RoomMemberWithUser[];
}

// Chỉ thành viên trong phòng mới xem được chi tiết phòng.
export async function findRoomDetail(
  rooms: RoomRepository,
  members: RoomMemberRepository,
  roomId: number,
  userId: number,
): Promise<RoomDetailOutput> {
  const room = await rooms.findById(RoomId.of(roomId));
  if (!room) throw new RoomNotFoundError();

  const memberRows = await members.findByRoomIdWithUser(roomId);
  if (!memberRows.some((m) => m.userId === userId)) {
    throw NotRoomMemberError.forbidden();
  }

  return { room, members: memberRows };
}
