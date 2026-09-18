import { RoomDomainError } from './room-domain.error';

export class RoomNotWaitingError extends RoomDomainError {
  private constructor(message: string) {
    super('CONFLICT', message);
  }

  static forJoin(): RoomNotWaitingError {
    return new RoomNotWaitingError('Ván đang diễn ra, không thể vào');
  }

  static forStart(): RoomNotWaitingError {
    return new RoomNotWaitingError('Phòng không ở trạng thái chờ');
  }
}
