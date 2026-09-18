import { UserDomainError } from './user-domain.error';

export class ForbiddenProfileEditError extends UserDomainError {
  constructor() {
    super('FORBIDDEN', 'Bạn chỉ được sửa thông tin của chính mình');
  }
}
