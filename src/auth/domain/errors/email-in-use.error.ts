import { AuthDomainError } from './auth-domain.error';

export class EmailInUseError extends AuthDomainError {
  constructor() {
    super('BAD_REQUEST', 'Email already in use');
  }
}
