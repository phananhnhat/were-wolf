// Số lượng người chơi cố định cho mỗi phòng — không cho phép giá trị tuỳ ý
export const ALLOWED_MAX_PLAYERS = [6, 8, 10, 15] as const;
export type MaxPlayers = (typeof ALLOWED_MAX_PLAYERS)[number];

// Cấu hình vai trò tương ứng mỗi mốc số người chơi — GameModule dùng để chia vai lúc bắt đầu
// ván, không lưu vào DB.
//
// Giai đoạn này chỉ có 2 vai: werewolf và villager. Các vai đặc biệt (seer, guard, witch,
// hunter, fool) sẽ bổ sung sau — khi đó chỉ cần sửa bảng này, buildShuffledRoles() không đổi.
// Số Sói giữ nguyên tỉ lệ cũ, phần còn lại là Dân.
export const ROLE_CONFIG_BY_MAX_PLAYERS: Record<
  MaxPlayers,
  Record<string, number>
> = {
  6: { werewolf: 1, villager: 5 },
  8: { werewolf: 2, villager: 6 },
  10: { werewolf: 2, villager: 8 },
  15: { werewolf: 3, villager: 12 },
};
