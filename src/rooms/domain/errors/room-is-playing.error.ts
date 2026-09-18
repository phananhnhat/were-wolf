import { RoomDomainError } from './room-domain.error';

export class RoomIsPlayingError extends RoomDomainError {
  constructor() {
    super('CONFLICT', 'Ván đang diễn ra, không thể rời phòng');
  }
}
