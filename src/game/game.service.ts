import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { GamePhase } from './domain/enums/game-phase.enum';
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
import type { StartGameInput } from './application/use-cases/start-game.use-case';
import {
  CancelGamesForRoomUseCase,
  CANCEL_GAMES_FOR_ROOM_USE_CASE,
} from './application/use-cases/cancel-games-for-room.use-case';

interface RoomDeletedPayload {
  roomId: number;
}

// Facade (Interface Adapter) — nơi GameController và RoomsModule (qua @OnEvent) gọi vào. Mỗi
// method chỉ delegate xuống đúng 1 use case ở Application layer, không tự chứa luật nghiệp vụ
// hay truy xuất DB nữa — những cái đó đã chuyển hết sang Domain/Application ở 2 bước trước.
// Cố ý GIỮ LẠI lớp Facade này (thay vì để GameController gọi thẳng use case) theo lựa chọn của
// dự án — xem CLEAN-ARCHITECTURE.md.
@Injectable()
export class GameService {
  constructor(
    @Inject(GET_GAME_STATE_USE_CASE)
    private readonly getGameStateUseCase: GetGameStateUseCase,
    @Inject(GET_MY_STATE_USE_CASE)
    private readonly getMyStateUseCase: GetMyStateUseCase,
    @Inject(SEER_CHECK_USE_CASE)
    private readonly seerCheckUseCase: SeerCheckUseCase,
    @Inject(GET_MY_SEER_CHECKS_USE_CASE)
    private readonly getMySeerChecksUseCase: GetMySeerChecksUseCase,
    @Inject(GUARDIAN_PROTECT_USE_CASE)
    private readonly guardianProtectUseCase: GuardianProtectUseCase,
    @Inject(GET_MY_GUARDIAN_PROTECTS_USE_CASE)
    private readonly getMyGuardianProtectsUseCase: GetMyGuardianProtectsUseCase,
    @Inject(WITCH_POISON_USE_CASE)
    private readonly witchPoisonUseCase: WitchPoisonUseCase,
    @Inject(WITCH_HEAL_USE_CASE)
    private readonly witchHealUseCase: WitchHealUseCase,
    @Inject(GET_MY_WITCH_ACTIONS_USE_CASE)
    private readonly getMyWitchActionsUseCase: GetMyWitchActionsUseCase,
    @Inject(CAST_WOLF_VOTE_USE_CASE)
    private readonly castWolfVoteUseCase: CastWolfVoteUseCase,
    @Inject(CAST_LYNCH_VOTE_USE_CASE)
    private readonly castLynchVoteUseCase: CastLynchVoteUseCase,
    @Inject(GET_VOTE_TALLY_USE_CASE)
    private readonly getVoteTallyUseCase: GetVoteTallyUseCase,
    @Inject(START_GAME_USE_CASE)
    private readonly startGameUseCase: StartGameUseCase,
    @Inject(CANCEL_GAMES_FOR_ROOM_USE_CASE)
    private readonly cancelGamesForRoomUseCase: CancelGamesForRoomUseCase,
  ) {}

  @OnEvent('room.started')
  handleRoomStarted(payload: StartGameInput): Promise<void> {
    return this.startGameUseCase.execute(payload);
  }

  @OnEvent('room.deleted')
  handleRoomDeleted(payload: RoomDeletedPayload): Promise<void> {
    return this.cancelGamesForRoomUseCase.execute(payload.roomId);
  }

  // Trạng thái ván — giống hệt nhau với mọi người trong ván, không chứa gì riêng tư. Xem
  // docs/game.md §9.2.
  getGameState(roomId: number, userId: number) {
    return this.getGameStateUseCase.execute(roomId, userId);
  }

  // Thông tin riêng của người gọi (vai, đồng đội Sói, làm được gì lúc này).
  getMyState(gameId: number, userId: number) {
    return this.getMyStateUseCase.execute(gameId, userId);
  }

  seerCheck(gameId: number, actorId: number, targetUserId: number) {
    return this.seerCheckUseCase.execute(gameId, actorId, targetUserId);
  }

  getMySeerChecks(gameId: number, actorId: number) {
    return this.getMySeerChecksUseCase.execute(gameId, actorId);
  }

  guardianProtect(gameId: number, actorId: number, targetUserId: number) {
    return this.guardianProtectUseCase.execute(gameId, actorId, targetUserId);
  }

  getMyGuardianProtects(gameId: number, actorId: number) {
    return this.getMyGuardianProtectsUseCase.execute(gameId, actorId);
  }

  witchPoison(gameId: number, actorId: number, targetUserId: number) {
    return this.witchPoisonUseCase.execute(gameId, actorId, targetUserId);
  }

  witchHeal(gameId: number, actorId: number) {
    return this.witchHealUseCase.execute(gameId, actorId);
  }

  getMyWitchActions(gameId: number, actorId: number) {
    return this.getMyWitchActionsUseCase.execute(gameId, actorId);
  }

  castWolfVote(gameId: number, voterId: number, targetUserId: number) {
    return this.castWolfVoteUseCase.execute(gameId, voterId, targetUserId);
  }

  castLynchVote(gameId: number, voterId: number, targetUserId: number) {
    return this.castLynchVoteUseCase.execute(gameId, voterId, targetUserId);
  }

  getWolfVoteTally(gameId: number, requesterId: number) {
    return this.getVoteTallyUseCase.execute(gameId, requesterId, {
      phase: GamePhase.NIGHT,
      wolfOnly: true,
    });
  }

  getLynchVoteTally(gameId: number, requesterId: number) {
    return this.getVoteTallyUseCase.execute(gameId, requesterId, {
      phase: GamePhase.DAY,
      wolfOnly: false,
    });
  }
}
