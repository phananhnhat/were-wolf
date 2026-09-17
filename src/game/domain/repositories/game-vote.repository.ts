import { GameVote } from '../entities/game-vote.entity';
import { GameId } from '../value-objects/game-id.vo';
import { PlayerId } from '../value-objects/player-id.vo';
import { GamePhase } from '../enums/game-phase.enum';

export const GAME_VOTE_REPOSITORY = Symbol('GAME_VOTE_REPOSITORY');

export interface GameVoteRepository {
  // Toàn bộ phiếu của một lượt (phase + dayNumber) — dùng để kiểm phiếu.
  findByPhase(
    gameId: GameId,
    phase: GamePhase,
    dayNumber: number,
  ): Promise<GameVote[]>;

  findByVoter(
    gameId: GameId,
    phase: GamePhase,
    dayNumber: number,
    voterId: PlayerId,
  ): Promise<GameVote | null>;

  // Upsert theo khoá (gameId, phase, dayNumber, voterId) — đổi phiếu ghi đè, không tạo dòng mới.
  save(vote: GameVote): Promise<void>;
}
