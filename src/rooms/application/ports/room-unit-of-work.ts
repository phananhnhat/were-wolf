import { RoomRepository } from '../../domain/repositories/room.repository';
import { RoomMemberRepository } from '../../domain/repositories/room-member.repository';

export interface RoomTransactionalRepositories {
  rooms: RoomRepository;
  members: RoomMemberRepository;
}

// PORT — giao dịch. Chỉ createRoom() và joinRoom() cần (2 chỗ duy nhất rooms.service.ts hiện
// dùng dataSource.transaction()) — leaveRoom()/startGame()/removeRoom() KHÔNG bọc transaction ở
// bản gốc, giữ nguyên như vậy.
export interface RoomUnitOfWork {
  runInTransaction<T>(
    work: (repos: RoomTransactionalRepositories) => Promise<T>,
  ): Promise<T>;
}

export const ROOM_UNIT_OF_WORK = Symbol('ROOM_UNIT_OF_WORK');
