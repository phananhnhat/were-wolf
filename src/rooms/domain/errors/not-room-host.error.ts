import { RoomDomainError } from './room-domain.error';

export class NotRoomHostError extends RoomDomainError {
  private constructor(message: string) {
    super('FORBIDDEN', message);
  }

  static forStart(): NotRoomHostError {
    return new NotRoomHostError('Chỉ chủ phòng mới được bắt đầu ván');
  }

  static forRemove(): NotRoomHostError {
    return new NotRoomHostError('Chỉ chủ phòng mới được xóa phòng');
  }
}
