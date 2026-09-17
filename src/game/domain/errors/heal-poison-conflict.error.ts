import { GameDomainError } from './game-domain.error';

// Chiều chặn "vừa cứu vừa độc cùng một người" — độc dùng ở NIGHT nên luôn xảy ra trước cứu ở
// SKILL. Xem docs/impl-phu-thuy.md §3.5.
export class HealPoisonConflictError extends GameDomainError {
  constructor() {
    super('BAD_REQUEST', 'Bạn vừa đầu độc chính người này, không thể cứu');
  }
}
