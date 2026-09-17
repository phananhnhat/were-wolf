import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { GameDomainError } from '../domain/errors/game-domain.error';

// Interface Adapter — dịch GameDomainError (Domain layer, không biết HTTP) sang đúng
// HttpException của NestJS theo `code`, để response HTTP giữ nguyên như trước khi tách layer
// (404/409/403/400 y hệt các ConflictException/ForbiddenException/... mà game.service.ts cũ
// từng tự throw trực tiếp).
@Catch(GameDomainError)
export class GameDomainExceptionFilter implements ExceptionFilter {
  catch(exception: GameDomainError, host: ArgumentsHost): void {
    const httpException = this.toHttpException(exception);
    const response = host.switchToHttp().getResponse<Response>();
    response
      .status(httpException.getStatus())
      .json(httpException.getResponse());
  }

  private toHttpException(exception: GameDomainError): HttpException {
    switch (exception.code) {
      case 'NOT_FOUND':
        return new NotFoundException(exception.message);
      case 'CONFLICT':
        return new ConflictException(exception.message);
      case 'FORBIDDEN':
        return new ForbiddenException(exception.message);
      case 'BAD_REQUEST':
        return new BadRequestException(exception.message);
    }
  }
}
