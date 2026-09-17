import { GamePhase } from '../enums/game-phase.enum';

// Thời lượng theo pha. NIGHT/DAY giữ 60s. SKILL chỉ mở khi còn Phù thuỷ sống và chỉ phục vụ
// đúng một quyết định (cứu hay không), nên ngắn hơn nhiều — xem docs/impl-phu-thuy.md §2.4.
//
// TẠM THỜI trùng với src/game/constants/timing.ts — dọn trùng lặp ở bước nối Application layer.
export const PHASE_DURATION_MS: Record<GamePhase, number> = {
  [GamePhase.NIGHT]: 60 * 1000,
  [GamePhase.SKILL]: 15 * 1000,
  [GamePhase.DAY]: 60 * 1000,
};
