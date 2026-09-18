import { RoomDomainError } from './room-domain.error';

export class RoomFullError extends RoomDomainError {
  constructor() {
    super('CONFLICT', 'Phòng đã đủ người');
  }
}
