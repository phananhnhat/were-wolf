import { RoomRepository } from '../../domain/repositories/room.repository';
import { RoomEventPublisher } from '../ports/room-event-publisher';
import { RoomRulesService } from '../../domain/services/room-rules.service';
import { RoomId } from '../../domain/value-objects/room-id.vo';
import { RoomNotFoundError } from '../../domain/errors/room-not-found.error';

export async function removeRoom(
  rooms: RoomRepository,
  eventPublisher: RoomEventPublisher,
  userId: number,
  roomId: number,
): Promise<{ message: string }> {
  const room = await rooms.findById(RoomId.of(roomId));
  if (!room) throw new RoomNotFoundError();

  RoomRulesService.assertIsHost(room, userId, 'remove');

  await rooms.delete(room); // cascade xoá room_members
  // GameModule lắng nghe để huỷ (CANCELLED) ván đang chạy của phòng này, nếu có.
  eventPublisher.roomDeleted(roomId);
  return { message: 'Đã xóa phòng' };
}
