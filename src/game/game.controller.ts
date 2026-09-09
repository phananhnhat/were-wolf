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

  // Trạng thái ván — giống hệt nhau với mọi người trong ván, không chứa gì riêng tư.
  @Get('room/:roomId')
  findByRoom(
    @CurrentUser() user: User,
    @Param('roomId', ParseIntPipe) roomId: number,
  ) {
    return this.gameService.getGameState(roomId, user.id);
  }

  // Thông tin riêng của người gọi (vai, đồng đội Sói, làm được gì lúc này). Tách khỏi
  // endpoint trên để endpoint đó không phụ thuộc người xem — xem docs/game.md §9.2.
  @Get(':gameId/me')
  findMyState(
    @CurrentUser() user: User,
    @Param('gameId', ParseIntPipe) gameId: number,
  ) {
    return this.gameService.getMyState(gameId, user.id);
  }

  // NIGHT: chỉ Sói còn sống gọi được (chọn nạn nhân). DAY: ai còn sống cũng gọi được
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

  // Kiểm phiếu hiện tại của pha đang mở — NIGHT chỉ Sói xem được, DAY ai cũng xem được.
  @Get(':gameId/votes')
  getVotes(
    @CurrentUser() user: User,
    @Param('gameId', ParseIntPipe) gameId: number,
  ) {
    return this.gameService.getVoteTally(gameId, user.id);
  }
}
