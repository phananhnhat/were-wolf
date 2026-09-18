import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';

// Hợp của mọi mã lỗi domain đang dùng ở các module (mỗi module chỉ throw 1 tập con —
// UserDomainErrorCode/GameDomainErrorCode không có UNAUTHORIZED/INTERNAL chẳng hạn — nhưng
// switch ở dưới xử lý đủ cả 6 nên không cần lặp lại theo từng module).
export type DomainErrorCode =
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'FORBIDDEN'
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'INTERNAL';

export interface DomainError {
  readonly code: DomainErrorCode;
  readonly message: string;
}

// Base dùng chung cho mọi *DomainExceptionFilter của từng module — dịch DomainError.code sang
// đúng HttpException. Mỗi module chỉ cần `@Catch(XxxDomainError) class XxxDomainExceptionFilter
// extends DomainExceptionFilter<XxxDomainError> {}`, không phải lặp lại switch-case này.
export abstract class DomainExceptionFilter<
  E extends DomainError,
> implements ExceptionFilter<E> {
  catch(exception: E, host: ArgumentsHost): void {
    const httpException = this.toHttpException(exception);
    const response = host.switchToHttp().getResponse<Response>();
    response
      .status(httpException.getStatus())
      .json(httpException.getResponse());
  }

  private toHttpException(exception: E): HttpException {
    switch (exception.code) {
      case 'NOT_FOUND':
        return new NotFoundException(exception.message);
      case 'CONFLICT':
        return new ConflictException(exception.message);
      case 'FORBIDDEN':
        return new ForbiddenException(exception.message);
      case 'BAD_REQUEST':
        return new BadRequestException(exception.message);
      case 'UNAUTHORIZED':
        return new UnauthorizedException(exception.message);
      case 'INTERNAL':
        return new InternalServerErrorException(exception.message);
    }
  }
}
