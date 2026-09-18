import { Injectable } from '@nestjs/common';
import { BaseLoggerAdapter } from '../../common/nest-logger.adapter';

@Injectable()
export class LoggerAdapter extends BaseLoggerAdapter {
  constructor() {
    super('GameModule');
  }
}
