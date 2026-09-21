import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RealtimeModule } from '../realtime/realtime.module';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { Game } from './infrastructure/persistence/game.orm-entity';
import { GamePlayer } from './infrastructure/persistence/game-player.orm-entity';
import { GameVote } from './infrastructure/persistence/game-vote.orm-entity';
import { GameAction } from './infrastructure/persistence/game-action.orm-entity';

import { GAME_REPOSITORY } from './domain/repositories/game.repository';
import { GAME_PLAYER_REPOSITORY } from './domain/repositories/game-player.repository';
import { GAME_VOTE_REPOSITORY } from './domain/repositories/game-vote.repository';
import { GAME_ACTION_REPOSITORY } from './domain/repositories/game-action.repository';
import { GAME_UNIT_OF_WORK } from './application/ports/game-unit-of-work';
import { GAME_PHASE_SCHEDULER } from './application/ports/game-phase-scheduler';
import { GAME_EVENT_PUBLISHER } from './application/ports/game-event-publisher';
import { REALTIME_GAME_PUBLISHER } from './application/ports/realtime-game-publisher';
import { GAME_LOGGER } from './application/ports/logger';

import { TypeOrmGameRepository } from './infrastructure/persistence/typeorm-game.repository';
import { TypeOrmGamePlayerRepository } from './infrastructure/persistence/typeorm-game-player.repository';
import { TypeOrmGameVoteRepository } from './infrastructure/persistence/typeorm-game-vote.repository';
import { TypeOrmGameActionRepository } from './infrastructure/persistence/typeorm-game-action.repository';
import { TypeOrmGameUnitOfWork } from './infrastructure/typeorm-game-unit-of-work';
import { GamePhaseSchedulerAdapter } from './infrastructure/game-phase-scheduler.adapter';
import { GameEventPublisherAdapter } from './infrastructure/game-event-publisher.adapter';
import { MqttRealtimeGamePublisherAdapter } from './infrastructure/mqtt-realtime-game-publisher.adapter';
import { LoggerAdapter } from './infrastructure/logger.adapter';

// Composition root của GameModule — nơi DUY NHẤT "biết" cả 4 layer cùng lúc. 9 provider (4
// repository Gateway + 5 port Gateway, cái mới nhất là REALTIME_GAME_PUBLISHER — đẩy state qua
// MQTT, xem PLAN-REALTIME.md), tất cả đều `@Injectable()` nên chỉ cần `useClass` — mỗi adapter
// tự khai deps của nó qua constructor (`@InjectRepository(...)` cho 4 cái đầu, các service
// NestJS chuẩn như DataSource/SchedulerRegistry/EventEmitter2/ConfigService cho 5 cái sau).
@Module({
  imports: [
    TypeOrmModule.forFeature([Game, GamePlayer, GameVote, GameAction]),
    // Đảm bảo RealtimeModule luôn chạy trước GameModule, cần khởi tạo server MQTT Broker trước
    RealtimeModule,
  ],
  controllers: [GameController],
  providers: [
    GameService,

    // --- 4 repository Gateway (bind interface Domain → TypeORM) ---
    { provide: GAME_REPOSITORY, useClass: TypeOrmGameRepository },
    { provide: GAME_PLAYER_REPOSITORY, useClass: TypeOrmGamePlayerRepository },
    { provide: GAME_VOTE_REPOSITORY, useClass: TypeOrmGameVoteRepository },
    { provide: GAME_ACTION_REPOSITORY, useClass: TypeOrmGameActionRepository },

    // --- 4 port Gateway (bind interface Application → NestJS thật) ---
    { provide: GAME_UNIT_OF_WORK, useClass: TypeOrmGameUnitOfWork },
    { provide: GAME_PHASE_SCHEDULER, useClass: GamePhaseSchedulerAdapter },
    { provide: GAME_EVENT_PUBLISHER, useClass: GameEventPublisherAdapter },
    {
      provide: REALTIME_GAME_PUBLISHER,
      useClass: MqttRealtimeGamePublisherAdapter,
    },
    { provide: GAME_LOGGER, useClass: LoggerAdapter },
  ],
})
export class GameModule {}
