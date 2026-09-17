import { Module } from '@nestjs/common';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { Game } from './entities/game.entity';
import { GamePlayer } from './entities/game-player.entity';
import { GameVote } from './entities/game-vote.entity';
import { GameAction } from './entities/game-action.entity';

import {
  GameRepository,
  GAME_REPOSITORY,
} from './domain/repositories/game.repository';
import {
  GamePlayerRepository,
  GAME_PLAYER_REPOSITORY,
} from './domain/repositories/game-player.repository';
import {
  GameVoteRepository,
  GAME_VOTE_REPOSITORY,
} from './domain/repositories/game-vote.repository';
import {
  GameActionRepository,
  GAME_ACTION_REPOSITORY,
} from './domain/repositories/game-action.repository';
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

import {
  GetGameStateUseCase,
  GET_GAME_STATE_USE_CASE,
} from './application/use-cases/get-game-state.use-case';
import {
  GetMyStateUseCase,
  GET_MY_STATE_USE_CASE,
} from './application/use-cases/get-my-state.use-case';
import {
  SeerCheckUseCase,
  SEER_CHECK_USE_CASE,
} from './application/use-cases/seer-check.use-case';
import {
  GetMySeerChecksUseCase,
  GET_MY_SEER_CHECKS_USE_CASE,
} from './application/use-cases/get-my-seer-checks.use-case';
import {
  GuardianProtectUseCase,
  GUARDIAN_PROTECT_USE_CASE,
} from './application/use-cases/guardian-protect.use-case';
import {
  GetMyGuardianProtectsUseCase,
  GET_MY_GUARDIAN_PROTECTS_USE_CASE,
} from './application/use-cases/get-my-guardian-protects.use-case';
import {
  WitchPoisonUseCase,
  WITCH_POISON_USE_CASE,
} from './application/use-cases/witch-poison.use-case';
import {
  WitchHealUseCase,
  WITCH_HEAL_USE_CASE,
} from './application/use-cases/witch-heal.use-case';
import {
  GetMyWitchActionsUseCase,
  GET_MY_WITCH_ACTIONS_USE_CASE,
} from './application/use-cases/get-my-witch-actions.use-case';
import {
  CastWolfVoteUseCase,
  CAST_WOLF_VOTE_USE_CASE,
} from './application/use-cases/cast-wolf-vote.use-case';
import {
  CastLynchVoteUseCase,
  CAST_LYNCH_VOTE_USE_CASE,
} from './application/use-cases/cast-lynch-vote.use-case';
import {
  GetVoteTallyUseCase,
  GET_VOTE_TALLY_USE_CASE,
} from './application/use-cases/get-vote-tally.use-case';
import {
  StartGameUseCase,
  START_GAME_USE_CASE,
} from './application/use-cases/start-game.use-case';
import {
  CancelGamesForRoomUseCase,
  CANCEL_GAMES_FOR_ROOM_USE_CASE,
} from './application/use-cases/cancel-games-for-room.use-case';
import {
  AdvanceGameUseCase,
  ADVANCE_GAME_USE_CASE,
} from './application/use-cases/advance-game.use-case';
import { GameUnitOfWork } from './application/ports/game-unit-of-work';
import { GamePhaseScheduler } from './application/ports/game-phase-scheduler';
import { GameEventPublisher } from './application/ports/game-event-publisher';
import { Logger } from './application/ports/logger';

// Composition root của GameModule — đây là nơi DUY NHẤT "biết" cả 4 layer cùng lúc: bind
// interface (Domain/Application) vào implementation cụ thể (Infrastructure), rồi lắp use case
// (Application, plain class — không @Injectable()) qua useFactory, cuối cùng GameService
// (Facade) nhận use case qua token. Domain/Application layer không đổi gì để phục vụ việc nối
// dây này — toàn bộ nằm gọn ở file này.
@Module({
  imports: [TypeOrmModule.forFeature([Game, GamePlayer, GameVote, GameAction])],
  controllers: [GameController],
  providers: [
    GameService,

    // --- Infrastructure: 4 repository Gateway (bind interface Domain → TypeORM) ---
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

    // --- Infrastructure: 4 port Gateway (bind interface Application → NestJS thật) ---
    { provide: GAME_UNIT_OF_WORK, useClass: TypeOrmGameUnitOfWork },
    { provide: GAME_PHASE_SCHEDULER, useClass: GamePhaseSchedulerAdapter },
    { provide: GAME_EVENT_PUBLISHER, useClass: GameEventPublisherAdapter },
    { provide: GAME_LOGGER, useClass: LoggerAdapter },

    // --- Application: 15 use case, tự `new` bằng useFactory (plain class, không @Injectable())
    {
      provide: GET_GAME_STATE_USE_CASE,
      useFactory: (games: GameRepository, players: GamePlayerRepository) =>
        new GetGameStateUseCase(games, players),
      inject: [GAME_REPOSITORY, GAME_PLAYER_REPOSITORY],
    },
    {
      provide: GET_MY_STATE_USE_CASE,
      useFactory: (
        games: GameRepository,
        players: GamePlayerRepository,
        votes: GameVoteRepository,
        actions: GameActionRepository,
      ) => new GetMyStateUseCase(games, players, votes, actions),
      inject: [
        GAME_REPOSITORY,
        GAME_PLAYER_REPOSITORY,
        GAME_VOTE_REPOSITORY,
        GAME_ACTION_REPOSITORY,
      ],
    },
    {
      provide: SEER_CHECK_USE_CASE,
      useFactory: (
        games: GameRepository,
        players: GamePlayerRepository,
        actions: GameActionRepository,
      ) => new SeerCheckUseCase(games, players, actions),
      inject: [GAME_REPOSITORY, GAME_PLAYER_REPOSITORY, GAME_ACTION_REPOSITORY],
    },
    {
      provide: GET_MY_SEER_CHECKS_USE_CASE,
      useFactory: (
        players: GamePlayerRepository,
        actions: GameActionRepository,
      ) => new GetMySeerChecksUseCase(players, actions),
      inject: [GAME_PLAYER_REPOSITORY, GAME_ACTION_REPOSITORY],
    },
    {
      provide: GUARDIAN_PROTECT_USE_CASE,
      useFactory: (
        games: GameRepository,
        players: GamePlayerRepository,
        actions: GameActionRepository,
      ) => new GuardianProtectUseCase(games, players, actions),
      inject: [GAME_REPOSITORY, GAME_PLAYER_REPOSITORY, GAME_ACTION_REPOSITORY],
    },
    {
      provide: GET_MY_GUARDIAN_PROTECTS_USE_CASE,
      useFactory: (
        players: GamePlayerRepository,
        actions: GameActionRepository,
      ) => new GetMyGuardianProtectsUseCase(players, actions),
      inject: [GAME_PLAYER_REPOSITORY, GAME_ACTION_REPOSITORY],
    },
    {
      provide: WITCH_POISON_USE_CASE,
      useFactory: (
        games: GameRepository,
        players: GamePlayerRepository,
        actions: GameActionRepository,
      ) => new WitchPoisonUseCase(games, players, actions),
      inject: [GAME_REPOSITORY, GAME_PLAYER_REPOSITORY, GAME_ACTION_REPOSITORY],
    },
    {
      provide: WITCH_HEAL_USE_CASE,
      useFactory: (
        games: GameRepository,
        players: GamePlayerRepository,
        votes: GameVoteRepository,
        actions: GameActionRepository,
      ) => new WitchHealUseCase(games, players, votes, actions),
      inject: [
        GAME_REPOSITORY,
        GAME_PLAYER_REPOSITORY,
        GAME_VOTE_REPOSITORY,
        GAME_ACTION_REPOSITORY,
      ],
    },
    {
      provide: GET_MY_WITCH_ACTIONS_USE_CASE,
      useFactory: (
        players: GamePlayerRepository,
        actions: GameActionRepository,
      ) => new GetMyWitchActionsUseCase(players, actions),
      inject: [GAME_PLAYER_REPOSITORY, GAME_ACTION_REPOSITORY],
    },
    {
      provide: GET_VOTE_TALLY_USE_CASE,
      useFactory: (
        games: GameRepository,
        players: GamePlayerRepository,
        votes: GameVoteRepository,
      ) => new GetVoteTallyUseCase(games, players, votes),
      inject: [GAME_REPOSITORY, GAME_PLAYER_REPOSITORY, GAME_VOTE_REPOSITORY],
    },
    {
      provide: CAST_WOLF_VOTE_USE_CASE,
      useFactory: (
        games: GameRepository,
        players: GamePlayerRepository,
        votes: GameVoteRepository,
        getVoteTally: GetVoteTallyUseCase,
      ) => new CastWolfVoteUseCase(games, players, votes, getVoteTally),
      inject: [
        GAME_REPOSITORY,
        GAME_PLAYER_REPOSITORY,
        GAME_VOTE_REPOSITORY,
        GET_VOTE_TALLY_USE_CASE,
      ],
    },
    {
      provide: CAST_LYNCH_VOTE_USE_CASE,
      useFactory: (
        games: GameRepository,
        players: GamePlayerRepository,
        votes: GameVoteRepository,
        getVoteTally: GetVoteTallyUseCase,
      ) => new CastLynchVoteUseCase(games, players, votes, getVoteTally),
      inject: [
        GAME_REPOSITORY,
        GAME_PLAYER_REPOSITORY,
        GAME_VOTE_REPOSITORY,
        GET_VOTE_TALLY_USE_CASE,
      ],
    },
    {
      provide: START_GAME_USE_CASE,
      useFactory: (
        games: GameRepository,
        unitOfWork: GameUnitOfWork,
        scheduler: GamePhaseScheduler,
        eventPublisher: GameEventPublisher,
        logger: Logger,
      ) =>
        new StartGameUseCase(
          games,
          unitOfWork,
          scheduler,
          eventPublisher,
          logger,
        ),
      inject: [
        GAME_REPOSITORY,
        GAME_UNIT_OF_WORK,
        GAME_PHASE_SCHEDULER,
        GAME_EVENT_PUBLISHER,
        GAME_LOGGER,
      ],
    },
    {
      provide: CANCEL_GAMES_FOR_ROOM_USE_CASE,
      useFactory: (games: GameRepository, scheduler: GamePhaseScheduler) =>
        new CancelGamesForRoomUseCase(games, scheduler),
      inject: [GAME_REPOSITORY, GAME_PHASE_SCHEDULER],
    },
    {
      provide: ADVANCE_GAME_USE_CASE,
      useFactory: (
        unitOfWork: GameUnitOfWork,
        scheduler: GamePhaseScheduler,
        eventPublisher: GameEventPublisher,
      ) => new AdvanceGameUseCase(unitOfWork, scheduler, eventPublisher),
      inject: [GAME_UNIT_OF_WORK, GAME_PHASE_SCHEDULER, GAME_EVENT_PUBLISHER],
    },
  ],
})
export class GameModule {}
