import {
  RoomUnitOfWork,
  RoomTransactionalRepositories,
} from '../ports/room-unit-of-work';
import { Room } from '../../domain/entities/room.entity';
import { RoomCode } from '../../domain/value-objects/room-code.vo';
import { RoomMember } from '../../domain/entities/room-member.entity';
import { AlreadyInAnotherRoomError } from '../../domain/errors/already-in-another-room.error';
import { RoomCodeCollisionError } from '../../domain/errors/room-code-collision.error';
import { RoomCodeGenerationFailedError } from '../../domain/errors/room-code-generation-failed.error';

const MAX_CODE_ATTEMPTS = 5;

export async function createRoom(
  unitOfWork: RoomUnitOfWork,
  userId: number,
  maxPlayers: number,
): Promise<Room> {
  return unitOfWork.runInTransaction(async (repos) => {
    if (await repos.members.findByUserId(userId)) {
      throw new AlreadyInAnotherRoomError();
    }

    const room = await saveWithUniqueCode(repos, userId, maxPlayers);

    await repos.members.save(RoomMember.join(room.id.toNumber(), userId, true));

    return room;
  });
}

async function saveWithUniqueCode(
  repos: RoomTransactionalRepositories,
  hostId: number,
  maxPlayers: number,
  attempt = 0,
): Promise<Room> {
  if (attempt >= MAX_CODE_ATTEMPTS) {
    throw new RoomCodeGenerationFailedError();
  }

  const room = Room.create(hostId, RoomCode.generateRandom(), maxPlayers);
  try {
    await repos.rooms.save(room);
    return room;
  } catch (err) {
    if (err instanceof RoomCodeCollisionError) {
      return saveWithUniqueCode(repos, hostId, maxPlayers, attempt + 1);
    }
    throw err;
  }
}
