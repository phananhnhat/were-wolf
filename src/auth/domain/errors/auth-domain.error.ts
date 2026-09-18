export type AuthDomainErrorCode =
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'FORBIDDEN'
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED';

export abstract class AuthDomainError extends Error {
  protected constructor(
    readonly code: AuthDomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
