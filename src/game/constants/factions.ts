// Ánh xạ vai trò (key trong ROLE_CONFIG_BY_MAX_PLAYERS) sang phe, dùng để tính điều kiện thắng
// (xem docs/game-rules.md §2, §5). Chưa xử lý điều kiện thắng của "Người điên" (phụ thuộc
// nguyên nhân chết — bị treo cổ — nằm trong rule engine đêm/ngày chưa xây dựng).
export const WEREWOLF_ROLES = ['werewolf'];
export const THIRD_PARTY_ROLES = ['fool'];
