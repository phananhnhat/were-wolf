import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseFilters,
} from '@nestjs/common';
import { GameService } from './game.service';
import { CastVoteDto } from './dto/cast-vote.dto';
import { SeerCheckDto } from './dto/seer-check.dto';
import { GuardianProtectDto } from './dto/guardian-protect.dto';
import { WitchPoisonDto } from './dto/witch-poison.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { GameDomainExceptionFilter } from './infrastructure/game-domain-exception.filter';

// GameDomainExceptionFilter dịch GameDomainError (ném ra từ use case, qua GameService) sang
// đúng HttpException — GameService không còn tự throw NotFoundException/... trực tiếp nữa, xem
// CLEAN-ARCHITECTURE.md.
@UseFilters(GameDomainExceptionFilter)
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

  // Sói bỏ phiếu chọn nạn nhân — chỉ dùng được ở pha NIGHT. Không được chọn Sói khác.
  @Post(':gameId/wolf/vote')
  @HttpCode(HttpStatus.OK)
  castWolfVote(
    @CurrentUser() user: User,
    @Param('gameId', ParseIntPipe) gameId: number,
    @Body() dto: CastVoteDto,
  ) {
    return this.gameService.castWolfVote(gameId, user.id, dto.targetUserId);
  }

  // Kiểm phiếu cắn của đêm nay — chỉ Sói xem được.
  @Get(':gameId/wolf/votes')
  getWolfVotes(
    @CurrentUser() user: User,
    @Param('gameId', ParseIntPipe) gameId: number,
  ) {
    return this.gameService.getWolfVoteTally(gameId, user.id);
  }

  // Cả làng bỏ phiếu treo cổ — chỉ dùng được ở pha DAY. Chọn được bất kỳ ai, kể cả Sói.
  @Post(':gameId/lynch/vote')
  @HttpCode(HttpStatus.OK)
  castLynchVote(
    @CurrentUser() user: User,
    @Param('gameId', ParseIntPipe) gameId: number,
    @Body() dto: CastVoteDto,
  ) {
    return this.gameService.castLynchVote(gameId, user.id, dto.targetUserId);
  }

  // Kiểm phiếu treo cổ của lượt này — ai trong ván cũng xem được.
  @Get(':gameId/lynch/votes')
  getLynchVotes(
    @CurrentUser() user: User,
    @Param('gameId', ParseIntPipe) gameId: number,
  ) {
    return this.gameService.getLynchVoteTally(gameId, user.id);
  }

  // Tiên tri soi 1 người trong đêm hiện tại. Mỗi đêm đúng 1 lượt, gọi rồi thì không đổi
  // được nữa (khác bỏ phiếu) — xem docs/role-tien-tri.md §2.
  @Post(':gameId/seer/check')
  @HttpCode(HttpStatus.OK)
  seerCheck(
    @CurrentUser() user: User,
    @Param('gameId', ParseIntPipe) gameId: number,
    @Body() dto: SeerCheckDto,
  ) {
    return this.gameService.seerCheck(gameId, user.id, dto.targetUserId);
  }

  // Lịch sử soi của chính người gọi, từ đầu ván.
  @Get(':gameId/seer/checks')
  getMySeerChecks(
    @CurrentUser() user: User,
    @Param('gameId', ParseIntPipe) gameId: number,
  ) {
    return this.gameService.getMySeerChecks(gameId, user.id);
  }

  // Bảo vệ che 1 người trong đêm nay. Không được tự che mình, không được che trùng người
  // 2 đêm liên tiếp. Không trả về thông tin gì của mục tiêu — xem docs/role-bao-ve.md.
  @Post(':gameId/guardian/protect')
  @HttpCode(HttpStatus.OK)
  guardianProtect(
    @CurrentUser() user: User,
    @Param('gameId', ParseIntPipe) gameId: number,
    @Body() dto: GuardianProtectDto,
  ) {
    return this.gameService.guardianProtect(gameId, user.id, dto.targetUserId);
  }

  // Lịch sử che của chính người gọi, từ đầu ván.
  @Get(':gameId/guardian/protects')
  getMyGuardianProtects(
    @CurrentUser() user: User,
    @Param('gameId', ParseIntPipe) gameId: number,
  ) {
    return this.gameService.getMyGuardianProtects(gameId, user.id);
  }

  // Phù thuỷ đầu độc 1 người — chỉ dùng được ở pha NIGHT, đúng 1 lần CẢ VÁN.
  @Post(':gameId/witch/poison')
  @HttpCode(HttpStatus.OK)
  witchPoison(
    @CurrentUser() user: User,
    @Param('gameId', ParseIntPipe) gameId: number,
    @Body() dto: WitchPoisonDto,
  ) {
    return this.gameService.witchPoison(gameId, user.id, dto.targetUserId);
  }

  // Phù thuỷ cứu nạn nhân bị Sói cắn đêm nay — chỉ dùng được ở pha SKILL, đúng 1 lần CẢ VÁN.
  // KHÔNG có body: mục tiêu luôn là nạn nhân của lượt này, server tự tính.
  @Post(':gameId/witch/heal')
  @HttpCode(HttpStatus.OK)
  witchHeal(
    @CurrentUser() user: User,
    @Param('gameId', ParseIntPipe) gameId: number,
  ) {
    return this.gameService.witchHeal(gameId, user.id);
  }

  // Lịch sử dùng cả 2 loại thuốc của chính người gọi, từ đầu ván.
  @Get(':gameId/witch/actions')
  getMyWitchActions(
    @CurrentUser() user: User,
    @Param('gameId', ParseIntPipe) gameId: number,
  ) {
    return this.gameService.getMyWitchActions(gameId, user.id);
  }
}
