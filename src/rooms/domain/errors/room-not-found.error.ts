import { RoomDomainError } from './room-domain.error';

export class RoomNotFoundError extends RoomDomainError {
  constructor() {
    super('NOT_FOUND', 'Không tìm thấy phòng');
  }
}
