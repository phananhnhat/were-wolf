import { AuthDomainError } from './auth-domain.error';

export class UsernameTakenError extends AuthDomainError {
  constructor() {
    super('BAD_REQUEST', 'Username already taken');
  }
}
