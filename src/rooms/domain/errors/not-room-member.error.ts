import { RoomDomainError } from './room-domain.error';

// 2 tình huống gốc trả 2 HTTP code khác nhau cho cùng một ý nghĩa "không phải thành viên phòng
// này": xem chi tiết phòng → 403 (đang cố xem phòng người khác); rời phòng → 404 (thao tác lên
// một tư cách thành viên không tồn tại).
export class NotRoomMemberError extends RoomDomainError {
  private constructor(code: 'FORBIDDEN' | 'NOT_FOUND', message: string) {
    super(code, message);
  }

  static forbidden(): NotRoomMemberError {
    return new NotRoomMemberError(
      'FORBIDDEN',
      'Bạn không phải thành viên của phòng này',
    );
  }

  static notFound(): NotRoomMemberError {
    return new NotRoomMemberError('NOT_FOUND', 'Bạn không ở trong phòng này');
  }
}
