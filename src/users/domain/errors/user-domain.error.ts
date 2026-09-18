import { BaseDomainError } from '../../../common/domain-error';

// Mọi lỗi nghiệp vụ của User kế thừa từ đây. Domain layer KHÔNG được biết tới
// NotFoundException/ForbiddenException/... của NestJS — Interface layer tự map `code` sang
// đúng HttpException bằng exception filter, domain không import @nestjs/common.
export type UserDomainErrorCode =
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'FORBIDDEN'
  | 'BAD_REQUEST';

export abstract class UserDomainError extends BaseDomainError {
  protected constructor(code: UserDomainErrorCode, message: string) {
    super(code, message);
  }
}
