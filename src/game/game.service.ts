import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { GamePhase } from './domain/enums/game-phase.enum';
import { GAME_REPOSITORY } from './domain/repositories/game.repository';
import { GAME_PLAYER_REPOSITORY } from './domain/repositories/game-player.repository';
import { GAME_VOTE_REPOSITORY } from './domain/repositories/game-vote.repository';
import { GAME_ACTION_REPOSITORY } from './domain/repositories/game-action.repository';
import { GAME_UNIT_OF_WORK } from './application/ports/game-unit-of-work';
import { GAME_PHASE_SCHEDULER } from './application/ports/game-phase-scheduler';
import { GAME_EVENT_PUBLISHER } from './application/ports/game-event-publisher';
import { REALTIME_GAME_PUBLISHER } from './application/ports/realtime-game-publisher';
import { GAME_LOGGER } from './application/ports/logger';

// `import type` — @Inject() bật emitDecoratorMetadata cho constructor, TS cần các type này
// KHÔNG tồn tại lúc runtime (interface biến mất khi compile), nếu không sẽ báo lỗi TS1272.
import type { GameRepository } from './domain/repositories/game.repository';
import type { GamePlayerRepository } from './domain/repositories/game-player.repository';
import type { GameVoteRepository } from './domain/repositories/game-vote.repository';
import type { GameActionRepository } from './domain/repositories/game-action.repository';
import type { GameUnitOfWork } from './application/ports/game-unit-of-work';
import type { GamePhaseScheduler } from './application/ports/game-phase-scheduler';
import type { GameEventPublisher } from './application/ports/game-event-publisher';
import type { RealtimeGamePublisher } from './application/ports/realtime-game-publisher';
import type { Logger } from './application/ports/logger';

import { getGameState } from './application/use-cases/get-game-state.use-case';
import { getMyState } from './application/use-cases/get-my-state.use-case';
import { seerCheck } from './application/use-cases/seer-check.use-case';
import { getMySeerChecks } from './application/use-cases/get-my-seer-checks.use-case';
import { guardianProtect } from './application/use-cases/guardian-protect.use-case';
import { getMyGuardianProtects } from './application/use-cases/get-my-guardian-protects.use-case';
import { witchPoison } from './application/use-cases/witch-poison.use-case';
import { witchHeal } from './application/use-cases/witch-heal.use-case';
import { getMyWitchActions } from './application/use-cases/get-my-witch-actions.use-case';
import { castWolfVote } from './application/use-cases/cast-wolf-vote.use-case';
import { castLynchVote } from './application/use-cases/cast-lynch-vote.use-case';
import { getVoteTally } from './application/use-cases/get-vote-tally.use-case';
import { startGame } from './application/use-cases/start-game.use-case';
import type { StartGameInput } from './application/use-cases/start-game.use-case';
import { cancelGamesForRoom } from './application/use-cases/cancel-games-for-room.use-case';

interface RoomDeletedPayload {
  roomId: number;
}

// Facade (Interface Adapter) — nơi GameController và RoomsModule (qua @OnEvent) gọi vào. Chỉ
// giữ 8 adapter thô (4 repository + 4 port) qua DI, rồi mỗi method gọi thẳng hàm use case
// (Application layer, plain function — không còn là class cần DI riêng, xem
// CLEAN-ARCHITECTURE.md). Cố ý GIỮ LẠI lớp Facade này (thay vì để GameController gọi thẳng use
// case) theo lựa chọn của dự án.
@Injectable()
export class GameService {
  constructor(
    @Inject(GAME_REPOSITORY) private readonly games: GameRepository,
    @Inject(GAME_PLAYER_REPOSITORY)
    private readonly players: GamePlayerRepository,
    @Inject(GAME_VOTE_REPOSITORY) private readonly votes: GameVoteRepository,
    @Inject(GAME_ACTION_REPOSITORY)
    private readonly actions: GameActionRepository,
    @Inject(GAME_UNIT_OF_WORK) private readonly unitOfWork: GameUnitOfWork,
    @Inject(GAME_PHASE_SCHEDULER)
    private readonly scheduler: GamePhaseScheduler,
    @Inject(GAME_EVENT_PUBLISHER)
    private readonly eventPublisher: GameEventPublisher,
    @Inject(REALTIME_GAME_PUBLISHER)
    private readonly realtime: RealtimeGamePublisher,
    @Inject(GAME_LOGGER) private readonly logger: Logger,
  ) {}

  @OnEvent('room.started')
  handleRoomStarted(payload: StartGameInput): Promise<void> {
    return startGame(
      this.games,
      this.unitOfWork,
      this.scheduler,
      this.eventPublisher,
      this.realtime,
      this.logger,
      payload,
    );
  }

  @OnEvent('room.deleted')
  handleRoomDeleted(payload: RoomDeletedPayload): Promise<void> {
    return cancelGamesForRoom(this.games, this.scheduler, payload.roomId);
  }

  // Trạng thái ván — giống hệt nhau với mọi người trong ván, không chứa gì riêng tư. Xem
  // docs/game.md §9.2.
  getGameState(roomId: number, userId: number) {
    return getGameState(this.games, this.players, roomId, userId);
  }

  // Thông tin riêng của người gọi (vai, đồng đội Sói, làm được gì lúc này).
  getMyState(gameId: number, userId: number) {
    return getMyState(
      this.games,
      this.players,
      this.votes,
      this.actions,
      gameId,
      userId,
    );
  }

  seerCheck(gameId: number, actorId: number, targetUserId: number) {
    return seerCheck(
      this.games,
      this.players,
      this.actions,
      gameId,
      actorId,
      targetUserId,
    );
  }

  getMySeerChecks(gameId: number, actorId: number) {
    return getMySeerChecks(this.players, this.actions, gameId, actorId);
  }

  guardianProtect(gameId: number, actorId: number, targetUserId: number) {
    return guardianProtect(
      this.games,
      this.players,
      this.actions,
      gameId,
      actorId,
      targetUserId,
    );
  }

  getMyGuardianProtects(gameId: number, actorId: number) {
    return getMyGuardianProtects(this.players, this.actions, gameId, actorId);
  }

  witchPoison(gameId: number, actorId: number, targetUserId: number) {
    return witchPoison(
      this.games,
      this.players,
      this.actions,
      gameId,
      actorId,
      targetUserId,
    );
  }

  witchHeal(gameId: number, actorId: number) {
    return witchHeal(
      this.games,
      this.players,
      this.votes,
      this.actions,
      gameId,
      actorId,
    );
  }

  getMyWitchActions(gameId: number, actorId: number) {
    return getMyWitchActions(this.players, this.actions, gameId, actorId);
  }

  castWolfVote(gameId: number, voterId: number, targetUserId: number) {
    return castWolfVote(
      this.games,
      this.players,
      this.votes,
      this.realtime,
      gameId,
      voterId,
      targetUserId,
    );
  }

  castLynchVote(gameId: number, voterId: number, targetUserId: number) {
    return castLynchVote(
      this.games,
      this.players,
      this.votes,
      this.realtime,
      gameId,
      voterId,
      targetUserId,
    );
  }

  getWolfVoteTally(gameId: number, requesterId: number) {
    return getVoteTally(
      this.games,
      this.players,
      this.votes,
      gameId,
      requesterId,
      {
        phase: GamePhase.NIGHT,
        wolfOnly: true,
      },
    );
  }

  getLynchVoteTally(gameId: number, requesterId: number) {
    return getVoteTally(
      this.games,
      this.players,
      this.votes,
      gameId,
      requesterId,
      {
        phase: GamePhase.DAY,
        wolfOnly: false,
      },
    );
  }
}
