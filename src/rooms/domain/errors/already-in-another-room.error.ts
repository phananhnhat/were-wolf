import { RoomDomainError } from './room-domain.error';

export class AlreadyInAnotherRoomError extends RoomDomainError {
  constructor() {
    super('CONFLICT', 'Bạn đang ở trong một phòng khác');
  }
}
