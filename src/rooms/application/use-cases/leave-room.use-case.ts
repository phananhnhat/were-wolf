import { RoomRepository } from '../../domain/repositories/room.repository';
import { RoomMemberRepository } from '../../domain/repositories/room-member.repository';
import { RoomId } from '../../domain/value-objects/room-id.vo';
import { RoomNotFoundError } from '../../domain/errors/room-not-found.error';
import { NotRoomMemberError } from '../../domain/errors/not-room-member.error';

// Cấm rời khi ván đang chạy; nếu host rời thì tự chuyển quyền host cho người vào sớm nhất
// (findByRoomId hợp đồng sắp theo joinedAt tăng dần), còn nếu hết người thì xoá luôn phòng.
// KHÔNG bọc transaction — giữ nguyên đặc điểm này từ bản gốc.
export async function leaveRoom(
  rooms: RoomRepository,
  members: RoomMemberRepository,
  userId: number,
  roomId: number,
): Promise<{ message: string }> {
  const room = await rooms.findById(RoomId.of(roomId));
  if (!room) throw new RoomNotFoundError();
  room.assertNotPlaying();

  const member = await members.findByRoomAndUser(roomId, userId);
  if (!member) throw NotRoomMemberError.notFound();

  await members.delete(member);

  if (!member.isHost) {
    return { message: 'Đã rời phòng' };
  }

  const remaining = await members.findByRoomId(roomId);
  if (remaining.length === 0) {
    await rooms.delete(room);
    return { message: 'Phòng đã bị xóa vì không còn ai' };
  }

  const newHost = remaining[0];
  newHost.promoteToHost();
  await members.save(newHost);
  room.transferHost(newHost.userId);
  await rooms.save(room);
  return { message: 'Đã rời phòng, quyền chủ phòng được chuyển' };
}
