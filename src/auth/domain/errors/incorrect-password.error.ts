import { AuthDomainError } from './auth-domain.error';

export class IncorrectPasswordError extends AuthDomainError {
  constructor() {
    super('FORBIDDEN', 'Current password is incorrect');
  }
}
