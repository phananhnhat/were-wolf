// Ánh xạ vai trò (key trong ROLE_CONFIG_BY_MAX_PLAYERS) sang phe, dùng để tính điều kiện thắng
// (xem docs/game-rules.md §5). Giai đoạn này chỉ có 2 vai: werewolf và villager — mọi vai
// không phải Sói đều thuộc phe Dân.
export const WEREWOLF_ROLES = ['werewolf'];

// Tên vai Tiên tri, khớp key trong ROLE_CONFIG_BY_MAX_PLAYERS. Thuộc phe Dân — không cần
// khai báo gì thêm vì mọi vai không nằm trong WEREWOLF_ROLES đều được tính là phe Dân.
export const SEER_ROLE = 'seer';
export const GUARDIAN_ROLE = 'guardian';
