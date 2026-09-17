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
// (NIGHT, wolfOnly = true) và kiểm phiếu treo cổ (DAY, wolfOnly = false) — castWolfVote/
// castLynchVote gọi lại hàm này sau khi ghi phiếu, y hệt castWolfVote()/castLynchVote() cũ
// gọi getWolfVoteTally()/getLynchVoteTally() ở dòng cuối.
export async function getVoteTally(
  games: GameRepository,
  players: GamePlayerRepository,
  votes: GameVoteRepository,
  gameId: number,
  requesterId: number,
  options: VoteTallyOptions,
): Promise<VoteTallyOutput> {
  const gid = GameId.of(gameId);
  const requesterPid = PlayerId.of(requesterId);

  const game = await games.findById(gid);
  if (!game) throw new GameNotFoundError();

  const requester = await players.findByGameAndUser(gid, requesterPid);
  if (!requester) throw new PlayerNotInGameError();

  if (options.wolfOnly && !requester.isWerewolf()) {
    throw new RoleNotAllowedError('Chỉ Ma Sói được xem phiếu ban đêm');
  }

  const voteRows = await votes.findByPhase(gid, options.phase, game.dayNumber);

  const tally = VoteTally.tallyByTarget(voteRows);
  const myVote = voteRows.find((v) => v.voterId.equals(requesterPid));

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
