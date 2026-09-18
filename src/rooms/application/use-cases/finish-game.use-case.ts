import { RoomRepository } from '../../domain/repositories/room.repository';
import { Room } from '../../domain/entities/room.entity';
import { RoomId } from '../../domain/value-objects/room-id.vo';
import { RoomNotFoundError } from '../../domain/errors/room-not-found.error';

// Gọi nội bộ khi GameModule báo ván kết thúc — không expose qua HTTP.
export async function finishGame(
  rooms: RoomRepository,
  roomId: number,
): Promise<Room> {
  const room = await rooms.findById(RoomId.of(roomId));
  if (!room) throw new RoomNotFoundError();
  room.finish();
  await rooms.save(room);
  return room;
}
