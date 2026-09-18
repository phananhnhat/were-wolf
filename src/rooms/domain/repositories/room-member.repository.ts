import { RoomMember } from '../entities/room-member.entity';

export const ROOM_MEMBER_REPOSITORY = Symbol('ROOM_MEMBER_REPOSITORY');

// Thông tin User rút gọn ghép kèm thành viên — chỉ dùng cho màn hình chi tiết phòng
// (findRoomDetail), KHÔNG phải domain entity: đây là read-model, hình dạng riêng cho 1 câu
// truy vấn cụ thể (JOIN users), không mang luật nghiệp vụ nào.
export interface RoomMemberUserView {
  id: number;
  name: string;
  username: string;
  email: string;
  address: string | null;
  gender: string | null;
  createdAt: Date;
}

export interface RoomMemberWithUser {
  // Id của chính dòng room_member (PK tự tăng) — bản gốc trả thẳng TypeORM entity nên field
  // này vốn có mặt trong response; giữ lại ở đây để không đổi hình dạng API.
  id: number;
  roomId: number;
  userId: number;
  isHost: boolean;
  joinedAt: Date;
  user: RoomMemberUserView;
}

export interface RoomMemberRepository {
  // HỢP ĐỒNG: kết quả sắp theo joinedAt tăng dần — leaveRoom() dựa vào thứ tự này để chọn host
  // mới là người vào sớm nhất.
  findByRoomId(roomId: number): Promise<RoomMember[]>;

  findByRoomAndUser(roomId: number, userId: number): Promise<RoomMember | null>;

  // Dùng riêng cho findRoomDetail() — JOIN sẵn thông tin User, tránh N+1 query.
  findByRoomIdWithUser(roomId: number): Promise<RoomMemberWithUser[]>;

  // Tra "user này đang ở phòng nào" trên TOÀN HỆ THỐNG (không giới hạn 1 phòng) — dùng để chặn
  // 1 user ở nhiều phòng cùng lúc.
  findByUserId(userId: number): Promise<RoomMember | null>;

  countByRoomId(roomId: number): Promise<number>;

  save(member: RoomMember): Promise<void>;
  delete(member: RoomMember): Promise<void>;
}
