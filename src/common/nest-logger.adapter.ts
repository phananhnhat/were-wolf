import { Logger as NestLogger } from '@nestjs/common';
import type { Logger } from './ports/logger';

// Gateway dùng chung — implement Logger (port) bằng Logger của @nestjs/common. Mỗi module chỉ
// cần 1 subclass 3 dòng truyền context name riêng vào super(), giữ được `useClass` (không cần
// useFactory) và tên log context riêng cho từng module.
export abstract class BaseLoggerAdapter implements Logger {
  private readonly logger: NestLogger;

  protected constructor(context: string) {
    this.logger = new NestLogger(context);
  }

  warn(message: string): void {
    this.logger.warn(message);
  }

  error(message: string, trace?: string): void {
    this.logger.error(message, trace);
  }
}
