// Số lượng người chơi cố định cho mỗi phòng — không cho phép giá trị tuỳ ý
export const ALLOWED_MAX_PLAYERS = [6, 8, 10, 15] as const;
export type MaxPlayers = (typeof ALLOWED_MAX_PLAYERS)[number];

// Cấu hình vai trò tương ứng mỗi mốc số người chơi — GameModule dùng để chia vai lúc bắt đầu
// ván, không lưu vào DB.
//
// Hiện có 3 vai: werewolf, villager, seer (Tiên tri — mỗi đêm soi 1 người, xem
// docs/role-tien-tri.md). Các vai còn lại (guard, witch, hunter, fool) bổ sung sau — khi đó
// chỉ cần sửa bảng này, buildShuffledRoles() không phải đụng vào.
// Số Sói giữ nguyên tỉ lệ cũ; thêm Tiên tri thì bớt 1 Dân thường ở mỗi mốc.
export const ROLE_CONFIG_BY_MAX_PLAYERS: Record<
  MaxPlayers,
  Record<string, number>
> = {
  6: { werewolf: 1, villager: 5, seer: 0 },
  8: { werewolf: 2, villager: 5, seer: 1 },
  10: { werewolf: 2, villager: 7, seer: 1 },
  15: { werewolf: 3, villager: 11, seer: 1 },
};
