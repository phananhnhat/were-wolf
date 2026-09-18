// PORT hẹp, do RealtimeModule (bên dùng) tự định nghĩa — cùng nguyên tắc "port hẹp do bên dùng
// tự định nghĩa" đã áp dụng cho GameStatusReader/UserDirectory (CLEAN-ARCHITECTURE.md mục 7):
// chỉ hỏi đúng 1 câu cần dùng (bước SUBSCRIBE MQTT — xem PLAN-REALTIME.md mục 5), không tái
// dùng RoomMemberRepository đầy đủ của RoomsModule, tránh RoomsModule phải export token ra
// ngoài chỉ để phục vụ 1 câu hỏi hẹp.
export interface RoomMembershipReader {
  isRoomMember(userId: number, roomId: number): Promise<boolean>;
}

export const ROOM_MEMBERSHIP_READER = Symbol('ROOM_MEMBERSHIP_READER');
