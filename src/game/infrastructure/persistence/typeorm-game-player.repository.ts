import { Repository } from 'typeorm';
import { GamePlayer as GamePlayerOrmEntity } from '../../entities/game-player.entity';
import { GamePlayer } from '../../domain/entities/game-player.entity';
import { GameId } from '../../domain/value-objects/game-id.vo';
import { PlayerId } from '../../domain/value-objects/player-id.vo';
import { Role } from '../../domain/value-objects/role.vo';
import { GamePlayerRepository } from '../../domain/repositories/game-player.repository';

// Gateway — implement GamePlayerRepository bằng TypeORM.
//
// GamePlayer domain KHÔNG giữ id tự tăng của Postgres (không cần cho luật nghiệp vụ — khoá tự
// nhiên gameId+userId là đủ). Nhưng save()/saveMany() cần biết đúng dòng nào để UPDATE (vd.
// đánh dấu isAlive=false) thay vì lỡ insert trùng, vi phạm UNIQUE(gameId, userId) — nên tự tra
// id hiện có theo khoá tự nhiên trước khi ghi. Thêm 1 SELECT/lần ghi, chấp nhận được vì tần
// suất ghi bảng này thấp (vài người chơi mỗi lượt).
export class TypeOrmGamePlayerRepository implements GamePlayerRepository {
  constructor(private readonly repo: Repository<GamePlayerOrmEntity>) {}

  async findByGameId(gameId: GameId): Promise<GamePlayer[]> {
    const rows = await this.repo.find({
      where: { gameId: gameId.toNumber() },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async findByGameAndUser(
    gameId: GameId,
    userId: PlayerId,
  ): Promise<GamePlayer | null> {
    const row = await this.repo.findOneBy({
      gameId: gameId.toNumber(),
      userId: userId.toNumber(),
    });
    return row ? this.toDomain(row) : null;
  }

  async saveMany(players: GamePlayer[]): Promise<void> {
    const rows = await Promise.all(
      players.map((p) => this.toOrmWithExistingId(p)),
    );
    await this.repo.save(rows);
  }

  async save(player: GamePlayer): Promise<void> {
    await this.repo.save(await this.toOrmWithExistingId(player));
  }

  private toDomain(row: GamePlayerOrmEntity): GamePlayer {
    return GamePlayer.reconstitute({
      gameId: row.gameId,
      userId: PlayerId.of(row.userId),
      role: Role.of(row.role),
      isAlive: row.isAlive,
    });
  }

  private async toOrmWithExistingId(
    player: GamePlayer,
  ): Promise<GamePlayerOrmEntity> {
    const existing = await this.repo.findOneBy({
      gameId: player.gameId,
      userId: player.userId.toNumber(),
    });
    return this.repo.create({
      id: existing?.id,
      gameId: player.gameId,
      userId: player.userId.toNumber(),
      role: player.role.toKey(),
      isAlive: player.isAlive,
    });
  }
}
