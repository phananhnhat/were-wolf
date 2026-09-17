import { Repository } from 'typeorm';
import { GameVote as GameVoteOrmEntity } from './game-vote.orm-entity';
import { GameVote } from '../../domain/entities/game-vote.entity';
import { GameId } from '../../domain/value-objects/game-id.vo';
import { PlayerId } from '../../domain/value-objects/player-id.vo';
import { GamePhase } from '../../domain/enums/game-phase.enum';
import { GameVoteRepository } from '../../domain/repositories/game-vote.repository';

// Gateway — implement GameVoteRepository bằng TypeORM.
//
// GameVote domain không giữ id tự tăng — save() tự tra id hiện có theo khoá tự nhiên
// (gameId, phase, dayNumber, voterId) trước khi ghi, để đổi phiếu ghi đè đúng dòng thay vì tạo
// dòng mới (vi phạm UNIQUE). Cùng lý do/đánh đổi như TypeOrmGamePlayerRepository.
export class TypeOrmGameVoteRepository implements GameVoteRepository {
  constructor(private readonly repo: Repository<GameVoteOrmEntity>) {}

  async findByPhase(
    gameId: GameId,
    phase: GamePhase,
    dayNumber: number,
  ): Promise<GameVote[]> {
    const rows = await this.repo.find({
      where: { gameId: gameId.toNumber(), phase, dayNumber },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async findByVoter(
    gameId: GameId,
    phase: GamePhase,
    dayNumber: number,
    voterId: PlayerId,
  ): Promise<GameVote | null> {
    const row = await this.repo.findOneBy({
      gameId: gameId.toNumber(),
      phase,
      dayNumber,
      voterId: voterId.toNumber(),
    });
    return row ? this.toDomain(row) : null;
  }

  async save(vote: GameVote): Promise<void> {
    const existing = await this.repo.findOneBy({
      gameId: vote.gameId,
      phase: vote.phase,
      dayNumber: vote.dayNumber,
      voterId: vote.voterId.toNumber(),
    });
    await this.repo.save(
      this.repo.create({
        id: existing?.id,
        gameId: vote.gameId,
        phase: vote.phase,
        dayNumber: vote.dayNumber,
        voterId: vote.voterId.toNumber(),
        targetId: vote.targetId.toNumber(),
      }),
    );
  }

  private toDomain(row: GameVoteOrmEntity): GameVote {
    return GameVote.reconstitute({
      gameId: row.gameId,
      phase: row.phase,
      dayNumber: row.dayNumber,
      voterId: PlayerId.of(row.voterId),
      targetId: PlayerId.of(row.targetId),
    });
  }
}
