import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { GameService } from './game.service';
import { CastVoteDto } from './dto/cast-vote.dto';
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

  // NIGHT: chỉ Sói còn sống gọi được (chọn nạn nhân). DAY_VOTE: ai còn sống cũng gọi được
  // (đề nghị treo cổ). Gọi lại = đổi phiếu. Rule engine tự kiểm phiếu và chuyển pha khi hết giờ.
  @Post(':gameId/vote')
  @HttpCode(HttpStatus.OK)
  vote(
    @CurrentUser() user: User,
    @Param('gameId', ParseIntPipe) gameId: number,
    @Body() dto: CastVoteDto,
  ) {
    return this.gameService.castVote(gameId, user.id, dto.targetUserId);
  }

  // Kiểm phiếu hiện tại của lượt đang mở — NIGHT chỉ Sói xem được, DAY_VOTE ai cũng xem được.
  @Get(':gameId/votes')
  getVotes(
    @CurrentUser() user: User,
    @Param('gameId', ParseIntPipe) gameId: number,
  ) {
    return this.gameService.getVoteTally(gameId, user.id);
  }
}
