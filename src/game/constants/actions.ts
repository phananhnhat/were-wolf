// Hành động dùng kỹ năng của các vai đặc biệt — KHÁC hoàn toàn với bỏ phiếu:
// một mình thực hiện, không cộng dồn, không giết ai, và không đổi ý được.
// Xem docs/role-tien-tri.md §2.
export enum GameActionType {
  SEER_CHECK = 'SEER_CHECK',
  GUARDIAN_PROTECT = 'GUARDIAN_PROTECT',
  WITCH_HEAL = 'WITCH_HEAL', // dùng ở pha SKILL — mục tiêu luôn là nạn nhân đêm nay
  WITCH_POISON = 'WITCH_POISON', // dùng ở pha NIGHT — mục tiêu do Phù thuỷ chọn
  // Sau này: HUNTER_SHOOT
}

// Kết quả soi của Tiên tri — cố ý chỉ nhị phân, KHÔNG trả tên vai cụ thể. Trả tên vai sẽ
// khiến Tiên tri biết luôn ai là Phù thuỷ/Thợ săn, làm hỏng cân bằng. Xem docs/role-tien-tri.md §7.
export enum SeerCheckResult {
  WEREWOLF = 'WEREWOLF',
  NOT_WEREWOLF = 'NOT_WEREWOLF',
}
