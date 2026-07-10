// Số lượng người chơi cố định cho mỗi phòng — không cho phép giá trị tuỳ ý
export const ALLOWED_MAX_PLAYERS = [6, 8, 10, 15] as const;
export type MaxPlayers = (typeof ALLOWED_MAX_PLAYERS)[number];

// Cấu hình vai trò tương ứng mỗi mốc số người chơi — dùng cho GameModule sau này
// khi chia vai lúc bắt đầu ván, không lưu vào DB
export const ROLE_CONFIG_BY_MAX_PLAYERS: Record<
  MaxPlayers,
  Record<string, number>
> = {
  6: { werewolf: 1, villager: 4, seer: 1 },
  8: { werewolf: 2, villager: 4, seer: 1, guard: 1 },
  10: { werewolf: 2, villager: 4, seer: 1, guard: 1, witch: 1, hunter: 1 },
  15: {
    werewolf: 3,
    villager: 6,
    seer: 1,
    guard: 1,
    witch: 1,
    hunter: 1,
    fool: 1,
  },
};
