import { BaseDomainError } from '../../../common/domain-error';

export type AuthDomainErrorCode =
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'FORBIDDEN'
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED';

export abstract class AuthDomainError extends BaseDomainError {
  protected constructor(code: AuthDomainErrorCode, message: string) {
    super(code, message);
  }
}
