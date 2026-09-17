import { GameRepository } from '../../domain/repositories/game.repository';
import { GamePlayerRepository } from '../../domain/repositories/game-player.repository';
import { GameVoteRepository } from '../../domain/repositories/game-vote.repository';
import { GameId } from '../../domain/value-objects/game-id.vo';
import { PlayerId } from '../../domain/value-objects/player-id.vo';
import { GamePhase } from '../../domain/enums/game-phase.enum';
import { GameVote } from '../../domain/entities/game-vote.entity';
import { GameRulesService } from '../../domain/services/game-rules.service';
import { GameNotFoundError } from '../../domain/errors/game-not-found.error';
import { PlayerNotInGameError } from '../../domain/errors/player-not-in-game.error';
import {
  GetVoteTallyUseCase,
  VoteTallyOutput,
} from './get-vote-tally.use-case';

export const CAST_WOLF_VOTE_USE_CASE = Symbol('CAST_WOLF_VOTE_USE_CASE');

// Sói bỏ/đổi phiếu chọn nạn nhân — chỉ dùng được ở pha NIGHT. Gọi lại nhiều lần trong cùng
// lượt = đổi phiếu, không cộng dồn (UNIQUE theo gameId+phase+dayNumber+voterId).
export class CastWolfVoteUseCase {
  constructor(
    private readonly games: GameRepository,
    private readonly players: GamePlayerRepository,
    private readonly votes: GameVoteRepository,
    private readonly getVoteTally: GetVoteTallyUseCase,
  ) {}

  async execute(
    gameId: number,
    voterId: number,
    targetUserId: number,
  ): Promise<VoteTallyOutput> {
    const gid = GameId.of(gameId);
    const voterPid = PlayerId.of(voterId);
    const targetPid = PlayerId.of(targetUserId);

    const game = await this.games.findById(gid);
    if (!game) throw new GameNotFoundError();

    const voter = await this.players.findByGameAndUser(gid, voterPid);
    if (!voter) throw new PlayerNotInGameError();

    const target = await this.players.findByGameAndUser(gid, targetPid);
    GameRulesService.assertCanVote(game, voter, target, GamePhase.NIGHT);

    // Luật riêng của bỏ phiếu cắn: chỉ Sói được vote, và không được chọn Sói khác (tự cắn
    // mình cũng nằm trong luật này). Không rò rỉ gì: chỉ Sói mới bỏ phiếu được ban đêm, mà Sói
    // vốn đã biết hết đồng đội.
    GameRulesService.assertWolfVoteRules(voter, target);

    const existing = await this.votes.findByVoter(
      gid,
      GamePhase.NIGHT,
      game.dayNumber,
      voterPid,
    );
    if (existing) {
      existing.changeTarget(targetPid);
      await this.votes.save(existing);
    } else {
      await this.votes.save(
        GameVote.cast(
          gameId,
          GamePhase.NIGHT,
          game.dayNumber,
          voterPid,
          targetPid,
        ),
      );
    }

    return this.getVoteTally.execute(gameId, voterId, {
      phase: GamePhase.NIGHT,
      wolfOnly: true,
    });
  }
}
