import { RoomRepository } from '../../domain/repositories/room.repository';
import { RoomId } from '../../domain/value-objects/room-id.vo';

export async function handleGameStartFailed(
  rooms: RoomRepository,
  roomId: number,
): Promise<void> {
  const room = await rooms.findById(RoomId.of(roomId));
  if (room && room.isPlaying()) {
    room.finish();
    await rooms.save(room);
  }
}
