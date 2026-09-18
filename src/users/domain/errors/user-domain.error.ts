// Mọi lỗi nghiệp vụ của User kế thừa từ đây. Domain layer KHÔNG được biết tới
// NotFoundException/ForbiddenException/... của NestJS — Interface layer tự map `code` sang
// đúng HttpException bằng exception filter, domain không import @nestjs/common.
export type UserDomainErrorCode =
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'FORBIDDEN'
  | 'BAD_REQUEST';

export abstract class UserDomainError extends Error {
  protected constructor(
    readonly code: UserDomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
