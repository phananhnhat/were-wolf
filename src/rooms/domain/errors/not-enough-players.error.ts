import { RoomDomainError } from './room-domain.error';

export class NotEnoughPlayersError extends RoomDomainError {
  constructor(maxPlayers: number) {
    super('BAD_REQUEST', `Cần đủ ${maxPlayers} người để bắt đầu`);
  }
}
