// Mọi lỗi nghiệp vụ của ván chơi kế thừa từ đây. Domain layer KHÔNG được biết tới
// BadRequestException/ForbiddenException/... của NestJS — framework nào chạy bên trên là
// chuyện của Interface layer. `code` đủ thông tin để bước đó tự map sang đúng HTTP status
// bằng một exception filter, thay vì domain phải import @nestjs/common.
export type GameDomainErrorCode =
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'FORBIDDEN'
  | 'BAD_REQUEST';

export abstract class GameDomainError extends Error {
  protected constructor(
    readonly code: GameDomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
