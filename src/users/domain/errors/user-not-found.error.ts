import { UserDomainError } from './user-domain.error';

export class UserNotFoundError extends UserDomainError {
  constructor(id: number) {
    // Giữ nguyên message tiếng Anh gốc của UsersService.findOne() hiện tại.
    super('NOT_FOUND', `User #${id} not found`);
  }
}
