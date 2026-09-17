import { GameId } from '../../domain/value-objects/game-id.vo';

export const GAME_PHASE_SCHEDULER = Symbol('GAME_PHASE_SCHEDULER');

// PORT — hẹn giờ đóng pha hiện tại của một ván. Application layer chỉ khai báo "cần được gọi
// lại sau durationMs cho đúng ván này" — AI gọi lại (thường là AdvanceGameUseCase) và gọi lại
// bằng cơ chế nào (setTimeout, SchedulerRegistry, BullMQ...) là việc của Infrastructure
// adapter, không phải interface này.
export interface GamePhaseScheduler {
  schedule(gameId: GameId, durationMs: number): void;

  // Huỷ lịch đang chờ của một ván — dùng khi ván kết thúc/bị huỷ, hoặc trước khi hẹn lịch mới
  // (mỗi ván chỉ giữ đúng 1 lịch chờ tại một thời điểm).
  cancel(gameId: GameId): void;
}
