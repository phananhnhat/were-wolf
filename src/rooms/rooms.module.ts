import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { Room } from './entities/room.entity';
import { RoomMember } from './entities/room-member.entity';
import { Game } from '../game/infrastructure/persistence/game.orm-entity';

import { ROOM_REPOSITORY } from './domain/repositories/room.repository';
import { ROOM_MEMBER_REPOSITORY } from './domain/repositories/room-member.repository';
import { ROOM_UNIT_OF_WORK } from './application/ports/room-unit-of-work';
import { ROOM_EVENT_PUBLISHER } from './application/ports/room-event-publisher';
import { GAME_STATUS_READER } from './application/ports/game-status-reader';
import { ROOM_LOGGER } from './application/ports/logger';

import { TypeOrmRoomRepository } from './infrastructure/persistence/typeorm-room.repository';
import { TypeOrmRoomMemberRepository } from './infrastructure/persistence/typeorm-room-member.repository';
import { TypeOrmRoomUnitOfWork } from './infrastructure/typeorm-room-unit-of-work';
import { RoomEventPublisherAdapter } from './infrastructure/room-event-publisher.adapter';
import { TypeOrmGameStatusReader } from './infrastructure/typeorm-game-status-reader';
import { LoggerAdapter } from './infrastructure/logger.adapter';

// Composition root của RoomsModule. `Game` chỉ dùng để TypeOrmGameStatusReader tự
// @InjectRepository — Domain/Application của Rooms không biết GameModule tồn tại (xem
// application/ports/game-status-reader.ts).
@Module({
  imports: [TypeOrmModule.forFeature([Room, RoomMember, Game])],
  controllers: [RoomsController],
  providers: [
    RoomsService,
    { provide: ROOM_REPOSITORY, useClass: TypeOrmRoomRepository },
    { provide: ROOM_MEMBER_REPOSITORY, useClass: TypeOrmRoomMemberRepository },
    { provide: ROOM_UNIT_OF_WORK, useClass: TypeOrmRoomUnitOfWork },
    { provide: ROOM_EVENT_PUBLISHER, useClass: RoomEventPublisherAdapter },
    { provide: GAME_STATUS_READER, useClass: TypeOrmGameStatusReader },
    { provide: ROOM_LOGGER, useClass: LoggerAdapter },
  ],
  exports: [RoomsService],
})
export class RoomsModule {}
