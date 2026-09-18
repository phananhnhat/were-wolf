import { Room } from '../entities/room.entity';
import { NotRoomHostError } from '../errors/not-room-host.error';
import { NotEnoughPlayersError } from '../errors/not-enough-players.error';

export class RoomRulesService {
  // `context` chỉ quyết định thông điệp lỗi (bắt đầu ván hay xoá phòng) — luật thì như nhau.
  static assertIsHost(
    room: Room,
    userId: number,
    context: 'start' | 'remove',
  ): void {
    if (!room.isHost(userId)) {
      throw context === 'start'
        ? NotRoomHostError.forStart()
        : NotRoomHostError.forRemove();
    }
  }

  static assertFullyStaffed(room: Room, memberCount: number): void {
    if (memberCount !== room.maxPlayers) {
      throw new NotEnoughPlayersError(room.maxPlayers);
    }
  }
}
