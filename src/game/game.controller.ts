import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { GameService } from './game.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('games')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Get('room/:roomId')
  findByRoom(
    @CurrentUser() user: User,
    @Param('roomId', ParseIntPipe) roomId: number,
  ) {
    return this.gameService.getGameStateForUser(roomId, user.id);
  }

  // Endpoint mô phỏng — đứng thay rule engine đêm/ngày chưa xây dựng, xem docs/game.md
  @Post(':gameId/kill/:userId')
  @HttpCode(HttpStatus.OK)
  kill(
    @CurrentUser() user: User,
    @Param('gameId', ParseIntPipe) gameId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.gameService.killPlayer(gameId, user.id, userId);
  }
}
