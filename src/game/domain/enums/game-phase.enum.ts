// Một lượt chơi gồm NIGHT → (SKILL, nếu còn Phù thuỷ sống) → DAY. Chỉ NIGHT và DAY mở cổng
// bỏ phiếu; vote của mỗi pha lưu riêng theo (phase, dayNumber). Xem docs/impl-phu-thuy.md.
export enum GamePhase {
  NIGHT = 'NIGHT', // Sói bỏ phiếu chọn nạn nhân; Bảo vệ che; Tiên tri soi; Phù thuỷ đầu độc
  SKILL = 'SKILL', // Chỉ mở khi còn Phù thuỷ sống. Không ai bỏ phiếu. Phù thuỷ xem nạn nhân
  // đêm nay rồi quyết định có cứu hay không — đây là lý do duy nhất pha này tồn tại
  DAY = 'DAY', // Cả làng bỏ phiếu treo cổ
}
