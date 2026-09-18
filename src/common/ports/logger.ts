// PORT — log, dùng chung cho mọi module. Tồn tại để Application layer không phải import Logger
// của @nestjs/common — dù class đó không thật sự cần NestJS runtime để chạy, Application layer
// vẫn giữ nguyên tắc không import bất kỳ thứ gì từ @nestjs/*. Infrastructure layer của từng
// module tự bọc Logger của NestJS lại để implement interface này (xem
// common/nest-logger.adapter.ts) — token DI (GAME_LOGGER, ROOM_LOGGER...) vẫn khai riêng ở từng
// module, để log giữ được tên context riêng (`[GameModule]`, `[RoomsModule]`...).
export interface Logger {
  warn(message: string): void;
  error(message: string, trace?: string): void;
}
