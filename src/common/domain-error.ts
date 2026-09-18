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

export abstract class BaseDomainError extends Error {
  protected constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
