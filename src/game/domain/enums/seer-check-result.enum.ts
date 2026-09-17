// Kết quả soi của Tiên tri — cố ý chỉ nhị phân, KHÔNG trả tên vai cụ thể. Trả tên vai sẽ
// khiến Tiên tri biết luôn ai là Phù thuỷ/Thợ săn, làm hỏng cân bằng. Xem docs/role-tien-tri.md §7.
export enum SeerCheckResult {
  WEREWOLF = 'WEREWOLF',
  NOT_WEREWOLF = 'NOT_WEREWOLF',
}
