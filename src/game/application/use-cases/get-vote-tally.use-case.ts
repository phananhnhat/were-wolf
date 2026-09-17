import { GameRepository } from '../../domain/repositories/game.repository';
import { GamePlayerRepository } from '../../domain/repositories/game-player.repository';
import { GameVoteRepository } from '../../domain/repositories/game-vote.repository';
import { GameId } from '../../domain/value-objects/game-id.vo';
import { PlayerId } from '../../domain/value-objects/player-id.vo';
import { GamePhase } from '../../domain/enums/game-phase.enum';
import { VoteTally } from '../../domain/services/vote-tally.service';
import { GameNotFoundError } from '../../domain/errors/game-not-found.error';
import { PlayerNotInGameError } from '../../domain/errors/player-not-in-game.error';
import { RoleNotAllowedError } from '../../domain/errors/role-not-allowed.error';

export const GET_VOTE_TALLY_USE_CASE = Symbol('GET_VOTE_TALLY_USE_CASE');

export interface VoteTallyOptions {
  phase: GamePhase;
  // NIGHT (phiếu cắn) chỉ Sói xem được (bàn bạc kín); DAY (phiếu treo cổ) ai trong ván cũng
  // xem được (bỏ phiếu công khai). Xem docs/PLAN.md §5.7.
  wolfOnly: boolean;
}

export interface VoteTallyOutput {
  phase: GamePhase;
  dayNumber: number;
  phaseEndsAt: Date | null;
  myVoteTargetId: number | null;
  tally: Array<{ targetUserId: number; count: number }>;
}

// Kiểm phiếu của lượt hiện tại theo đúng 1 pha cố định. Dùng chung cho cả kiểm phiếu cắn
// (NIGHT, wolfOnly = true) và kiểm phiếu treo cổ (DAY, wolfOnly = false) — 1-1 với private
// getVoteTally() trong game.service.ts, nơi CastWolfVoteUseCase/CastLynchVoteUseCase gọi lại
// sau khi ghi phiếu, giống castWolfVote()/castLynchVote() hiện tại gọi getWolfVoteTally()/
// getLynchVoteTally() ở dòng cuối.
export class GetVoteTallyUseCase {
  constructor(
    private readonly games: GameRepository,
    private readonly players: GamePlayerRepository,
    private readonly votes: GameVoteRepository,
  ) {}

  async execute(
    gameId: number,
    requesterId: number,
    options: VoteTallyOptions,
  ): Promise<VoteTallyOutput> {
    const gid = GameId.of(gameId);
    const requesterPid = PlayerId.of(requesterId);

    const game = await this.games.findById(gid);
    if (!game) throw new GameNotFoundError();

    const requester = await this.players.findByGameAndUser(gid, requesterPid);
    if (!requester) throw new PlayerNotInGameError();

    if (options.wolfOnly && !requester.isWerewolf()) {
      throw new RoleNotAllowedError('Chỉ Ma Sói được xem phiếu ban đêm');
    }

    const votes = await this.votes.findByPhase(
      gid,
      options.phase,
      game.dayNumber,
    );

    const tally = VoteTally.tallyByTarget(votes);
    const myVote = votes.find((v) => v.voterId.equals(requesterPid));

    return {
      phase: options.phase,
      dayNumber: game.dayNumber,
      phaseEndsAt: game.phaseEndsAt,
      myVoteTargetId: myVote?.targetId.toNumber() ?? null,
      tally: [...tally.entries()]
        .map(([targetUserId, count]) => ({ targetUserId, count }))
        .sort((a, b) => b.count - a.count),
    };
  }
}
