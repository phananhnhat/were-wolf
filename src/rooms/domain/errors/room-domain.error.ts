export type RoomDomainErrorCode =
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'FORBIDDEN'
  | 'BAD_REQUEST'
  | 'INTERNAL';

export abstract class RoomDomainError extends Error {
  protected constructor(
    readonly code: RoomDomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
