import { RoomDomainError } from './room-domain.error';

// Tín hiệu NỘI BỘ "mã phòng vừa sinh bị trùng, thử mã khác" — implementation của
// RoomRepository.save() ném ra khi UNIQUE constraint trên cột `code` bị vi phạm lúc lưu Room
// mới. KHÔNG lộ ra HTTP (createRoom() bắt lại để retry); nếu retry hết lượt mới ném
// RoomCodeGenerationFailedError — đó mới là lỗi thật sự trả về client.
export class RoomCodeCollisionError extends RoomDomainError {
  constructor() {
    super('CONFLICT', 'Mã phòng vừa sinh bị trùng');
  }
}
