import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { ListRoomsDto } from './dto/list-rooms.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  findAll(@Query() query: ListRoomsDto) {
    return this.roomsService.findWaitingRooms(
      query.page ? Number(query.page) : undefined,
      query.limit ? Number(query.limit) : undefined,
    );
  }

  // Phải khai báo TRƯỚC @Get(':id') — nếu không '/rooms/me' sẽ khớp vào :id rồi
  // ParseIntPipe ném 400 vì 'me' không phải số.
  @Get('me')
  findMine(@CurrentUser() user: User) {
    return this.roomsService.findMyRoom(user.id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.roomsService.findRoomDetail(id, user.id);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateRoomDto) {
    return this.roomsService.createRoom(user.id, dto);
  }

  @Post('join')
  join(@CurrentUser() user: User, @Body() dto: JoinRoomDto) {
    return this.roomsService.joinRoom(user.id, dto);
  }

  @Post(':id/leave')
  @HttpCode(HttpStatus.OK)
  leave(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.roomsService.leaveRoom(user.id, id);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  start(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.roomsService.startGame(user.id, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.roomsService.removeRoom(user.id, id);
  }
}
