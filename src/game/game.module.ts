import { Module } from '@nestjs/common';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { Game } from './entities/game.entity';
import { GamePlayer } from './entities/game-player.entity';
import { GameVote } from './entities/game-vote.entity';
import { GameAction } from './entities/game-action.entity';

import { GAME_REPOSITORY } from './domain/repositories/game.repository';
import { GAME_PLAYER_REPOSITORY } from './domain/repositories/game-player.repository';
import { GAME_VOTE_REPOSITORY } from './domain/repositories/game-vote.repository';
import { GAME_ACTION_REPOSITORY } from './domain/repositories/game-action.repository';
import { GAME_UNIT_OF_WORK } from './application/ports/game-unit-of-work';
import { GAME_PHASE_SCHEDULER } from './application/ports/game-phase-scheduler';
import { GAME_EVENT_PUBLISHER } from './application/ports/game-event-publisher';
import { GAME_LOGGER } from './application/ports/logger';

import { TypeOrmGameRepository } from './infrastructure/persistence/typeorm-game.repository';
import { TypeOrmGamePlayerRepository } from './infrastructure/persistence/typeorm-game-player.repository';
import { TypeOrmGameVoteRepository } from './infrastructure/persistence/typeorm-game-vote.repository';
import { TypeOrmGameActionRepository } from './infrastructure/persistence/typeorm-game-action.repository';
import { TypeOrmGameUnitOfWork } from './infrastructure/typeorm-game-unit-of-work';
import { GamePhaseSchedulerAdapter } from './infrastructure/game-phase-scheduler.adapter';
import { GameEventPublisherAdapter } from './infrastructure/game-event-publisher.adapter';
import { LoggerAdapter } from './infrastructure/logger.adapter';

// Composition root của GameModule — nơi DUY NHẤT "biết" cả 4 layer cùng lúc. Chỉ còn 8 provider
// (4 repository Gateway + 4 port Gateway) — Application layer giờ là HÀM thuần (xem
// application/use-cases/), không còn là class cần đăng ký provider riêng, nên GameService chỉ
// cần inject 8 adapter thô này rồi tự gọi hàm use case tương ứng.
@Module({
  imports: [TypeOrmModule.forFeature([Game, GamePlayer, GameVote, GameAction])],
  controllers: [GameController],
  providers: [
    GameService,

    // --- 4 repository Gateway (bind interface Domain → TypeORM) ---
    {
      provide: GAME_REPOSITORY,
      useFactory: (repo: Repository<Game>) => new TypeOrmGameRepository(repo),
      inject: [getRepositoryToken(Game)],
    },
    {
      provide: GAME_PLAYER_REPOSITORY,
      useFactory: (repo: Repository<GamePlayer>) =>
        new TypeOrmGamePlayerRepository(repo),
      inject: [getRepositoryToken(GamePlayer)],
    },
    {
      provide: GAME_VOTE_REPOSITORY,
      useFactory: (repo: Repository<GameVote>) =>
        new TypeOrmGameVoteRepository(repo),
      inject: [getRepositoryToken(GameVote)],
    },
    {
      provide: GAME_ACTION_REPOSITORY,
      useFactory: (repo: Repository<GameAction>) =>
        new TypeOrmGameActionRepository(repo),
      inject: [getRepositoryToken(GameAction)],
    },

    // --- 4 port Gateway (bind interface Application → NestJS thật) ---
    { provide: GAME_UNIT_OF_WORK, useClass: TypeOrmGameUnitOfWork },
    { provide: GAME_PHASE_SCHEDULER, useClass: GamePhaseSchedulerAdapter },
    { provide: GAME_EVENT_PUBLISHER, useClass: GameEventPublisherAdapter },
    { provide: GAME_LOGGER, useClass: LoggerAdapter },
  ],
})
export class GameModule {}
