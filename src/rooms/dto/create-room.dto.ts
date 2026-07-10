import { IsIn } from 'class-validator';
import { ALLOWED_MAX_PLAYERS } from '../constants/room-configs';

export class CreateRoomDto {
  @IsIn(ALLOWED_MAX_PLAYERS)
  maxPlayers: number;
}
