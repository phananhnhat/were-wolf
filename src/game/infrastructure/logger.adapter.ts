import { Injectable, Logger as NestLogger } from '@nestjs/common';
import { Logger } from '../application/ports/logger';

// Gateway — implement Logger (port) bằng Logger của @nestjs/common.
@Injectable()
export class LoggerAdapter implements Logger {
  private readonly logger = new NestLogger('GameModule');

  warn(message: string): void {
    this.logger.warn(message);
  }

  error(message: string, trace?: string): void {
    this.logger.error(message, trace);
  }
}
