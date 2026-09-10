// Ánh xạ vai trò (key trong ROLE_CONFIG_BY_MAX_PLAYERS) sang phe, dùng để tính điều kiện
// thắng (xem docs/game-rules.md §5). Chỉ cần liệt kê phe Sói — mọi vai không nằm trong
// danh sách này đều được tính là phe Dân, nên thêm vai mới cho phe Dân không phải sửa gì.
export const WEREWOLF_ROLES = ['werewolf'];

// Tên các vai có kỹ năng, khớp key trong ROLE_CONFIG_BY_MAX_PLAYERS. Cả hai đều thuộc phe Dân.
export const SEER_ROLE = 'seer'; // mỗi đêm soi 1 người: có phải Sói không
export const GUARDIAN_ROLE = 'guardian'; // mỗi đêm che 1 người khỏi bị Sói cắn
