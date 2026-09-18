import { RoomRepository } from '../../domain/repositories/room.repository';
import { RoomMemberRepository } from '../../domain/repositories/room-member.repository';
import { RoomEventPublisher } from '../ports/room-event-publisher';
import { RoomRulesService } from '../../domain/services/room-rules.service';
import { Room } from '../../domain/entities/room.entity';
import { RoomId } from '../../domain/value-objects/room-id.vo';
import { RoomNotFoundError } from '../../domain/errors/room-not-found.error';

export async function startGame(
  rooms: RoomRepository,
  members: RoomMemberRepository,
  eventPublisher: RoomEventPublisher,
  userId: number,
  roomId: number,
): Promise<Room> {
  const room = await rooms.findById(RoomId.of(roomId));
  if (!room) throw new RoomNotFoundError();

  RoomRulesService.assertIsHost(room, userId, 'start');
  room.assertWaiting('start');

  const roster = await members.findByRoomId(roomId);
  RoomRulesService.assertFullyStaffed(room, roster.length);

  room.start();
  await rooms.save(room);

  // GameModule lắng nghe event này để tạo ván + chia vai — không import trực tiếp để tránh
  // circular dependency, xem docs/game.md §2.
  eventPublisher.roomStarted({
    roomId: room.id.toNumber(),
    maxPlayers: room.maxPlayers,
    memberIds: roster.map((m) => m.userId),
  });

  return room;
}
