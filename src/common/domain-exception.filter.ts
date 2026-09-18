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
import type { DomainError } from './domain-error';

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
