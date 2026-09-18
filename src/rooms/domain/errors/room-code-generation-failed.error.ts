import { RoomDomainError } from './room-domain.error';

export class RoomCodeGenerationFailedError extends RoomDomainError {
  constructor() {
    super('INTERNAL', 'Không thể tạo mã phòng, vui lòng thử lại');
  }
}
