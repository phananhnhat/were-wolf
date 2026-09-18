import { RoomUnitOfWork } from '../ports/room-unit-of-work';
import { Room } from '../../domain/entities/room.entity';
import { RoomCode } from '../../domain/value-objects/room-code.vo';
import { RoomMember } from '../../domain/entities/room-member.entity';
import { RoomNotFoundError } from '../../domain/errors/room-not-found.error';
import { AlreadyInAnotherRoomError } from '../../domain/errors/already-in-another-room.error';
import { RoomFullError } from '../../domain/errors/room-full.error';

export async function joinRoom(
  unitOfWork: RoomUnitOfWork,
  userId: number,
  code: string,
): Promise<Room> {
  const roomCode = RoomCode.of(code);

  return unitOfWork.runInTransaction(async (repos) => {
    // Khoá pessimistic_write ngay từ đây — chặn race condition vượt quá maxPlayers khi nhiều
    // người join cùng lúc.
    const room = await repos.rooms.findByCodeForUpdate(roomCode);
    if (!room) throw new RoomNotFoundError();
    room.assertWaiting('join');

    if (await repos.members.findByUserId(userId)) {
      throw new AlreadyInAnotherRoomError();
    }

    const memberCount = await repos.members.countByRoomId(room.id.toNumber());
    if (memberCount >= room.maxPlayers) {
      throw new RoomFullError();
    }

    await repos.members.save(
      RoomMember.join(room.id.toNumber(), userId, false),
    );
    return room;
  });
}
