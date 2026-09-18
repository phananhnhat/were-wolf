import { RoomRepository } from '../../domain/repositories/room.repository';
import { RoomMemberRepository } from '../../domain/repositories/room-member.repository';
import { findRoomDetail, RoomDetailOutput } from './find-room-detail.use-case';

// Phòng mà user đang ở, hoặc null nếu không ở phòng nào. Dùng để khôi phục trạng thái sau khi
// client tải lại trang — lúc đó client không còn nhớ roomId nào cả.
//
// Luôn trả tối đa 1 phòng: cả createRoom() lẫn joinRoom() đều chặn user đang ở phòng khác, nên
// mỗi user chỉ thuộc đúng một phòng tại một thời điểm.
export async function findMyRoom(
  rooms: RoomRepository,
  members: RoomMemberRepository,
  userId: number,
): Promise<{ room: RoomDetailOutput | null }> {
  const member = await members.findByUserId(userId);
  if (!member) return { room: null };
  return { room: await findRoomDetail(rooms, members, member.roomId, userId) };
}
