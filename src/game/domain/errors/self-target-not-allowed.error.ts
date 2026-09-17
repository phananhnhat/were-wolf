import { GameDomainError } from './game-domain.error';

// "Không thể tự soi / tự bảo vệ / tự đầu độc chính mình" — cùng 1 luật, khác động từ theo vai.
export class SelfTargetNotAllowedError extends GameDomainError {
  constructor(action: string) {
    super('BAD_REQUEST', `Không thể tự ${action} chính mình`);
  }
}
