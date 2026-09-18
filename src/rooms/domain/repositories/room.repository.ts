import { Room } from '../entities/room.entity';
import { RoomId } from '../value-objects/room-id.vo';
import { RoomCode } from '../value-objects/room-code.vo';

export const ROOM_REPOSITORY = Symbol('ROOM_REPOSITORY');

export interface WaitingRoomsPage {
  items: Room[];
  total: number;
}

export interface RoomRepository {
  findById(id: RoomId): Promise<Room | null>;

  // Khoá pessimistic_write trong transaction — dùng lúc joinRoom() để chặn race condition
  // vượt quá maxPlayers khi nhiều người join cùng lúc.
  findByCodeForUpdate(code: RoomCode): Promise<Room | null>;

  findWaiting(page: number, limit: number): Promise<WaitingRoomsPage>;

  // Phòng PLAYING đã lâu (updatedAt < cutoff) — dùng cho job reconcileStuckRooms().
  findAllPlayingUpdatedBefore(cutoff: Date): Promise<Room[]>;

  // Hợp đồng: nếu vi phạm UNIQUE trên cột `code` lúc lưu Room MỚI, implementation phải ném lại
  // RoomCodeCollisionError (không phải lỗi Postgres thô) — createRoom() bắt lỗi này để tự sinh
  // mã khác và thử lại.
  save(room: Room): Promise<void>;
  delete(room: Room): Promise<void>;
}
