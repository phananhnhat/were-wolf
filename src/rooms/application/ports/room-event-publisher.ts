export interface RoomStartedPayload {
  roomId: number;
  maxPlayers: number;
  memberIds: number[];
}

// PORT — phát sự kiện tích hợp RA NGOÀI RoomsModule, để GameModule phản ứng (tạo ván + chia
// vai khi phòng bắt đầu, huỷ ván khi phòng bị xoá). Tương đương 2 event 'room.started'/
// 'room.deleted' mà rooms.service.ts hiện phát qua EventEmitter2.
export interface RoomEventPublisher {
  roomStarted(payload: RoomStartedPayload): void;
  roomDeleted(roomId: number): void;
}

export const ROOM_EVENT_PUBLISHER = Symbol('ROOM_EVENT_PUBLISHER');
