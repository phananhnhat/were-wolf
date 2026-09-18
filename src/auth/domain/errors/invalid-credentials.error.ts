import { AuthDomainError } from './auth-domain.error';

export class InvalidCredentialsError extends AuthDomainError {
  constructor() {
    super('UNAUTHORIZED', 'Invalid credentials');
  }
}
