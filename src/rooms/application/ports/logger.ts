// PORT — log, giống hệt GameModule's Logger port (xem game/application/ports/logger.ts).
export interface Logger {
  warn(message: string): void;
  error(message: string, trace?: string): void;
}

export const ROOM_LOGGER = Symbol('ROOM_LOGGER');
