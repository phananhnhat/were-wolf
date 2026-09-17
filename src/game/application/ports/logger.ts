// PORT — log. Tồn tại để StartGameUseCase không phải import Logger của @nestjs/common — dù
// class đó không thật sự cần NestJS runtime để chạy, Application layer vẫn giữ nguyên tắc
// không import bất kỳ thứ gì từ @nestjs/*. Infrastructure layer sẽ bọc Logger của NestJS lại
// để implement interface này.
export interface Logger {
  warn(message: string): void;
  error(message: string, trace?: string): void;
}

export const GAME_LOGGER = Symbol('GAME_LOGGER');
