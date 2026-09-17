import { In, Repository } from 'typeorm';
import { GameAction as GameActionOrmEntity } from '../../entities/game-action.entity';
import { GameAction } from '../../domain/entities/game-action.entity';
import { GameId } from '../../domain/value-objects/game-id.vo';
import { PlayerId } from '../../domain/value-objects/player-id.vo';
import { GameActionType } from '../../domain/enums/game-action-type.enum';
import { GameActionRepository } from '../../domain/repositories/game-action.repository';
import { SkillAlreadyUsedError } from '../../domain/errors/skill-already-used.error';

// Gateway — implement GameActionRepository bằng TypeORM.
//
// record() là INSERT-ONLY (append-only, đúng bản chất GameAction ở Domain layer). Hợp đồng đã
// ghi ở domain/repositories/game-action.repository.ts: vi phạm UNIQUE constraint (Postgres mã
// 23505 — "đã dùng kỹ năng rồi") PHẢI dịch thành SkillAlreadyUsedError, không để lộ chi tiết
// Postgres ra khỏi Infrastructure layer.
export class TypeOrmGameActionRepository implements GameActionRepository {
  constructor(private readonly repo: Repository<GameActionOrmEntity>) {}

  async findOneByActorAndDay(
    gameId: GameId,
    dayNumber: number,
    actionType: GameActionType,
    actorId: PlayerId,
  ): Promise<GameAction | null> {
    const row = await this.repo.findOneBy({
      gameId: gameId.toNumber(),
      dayNumber,
      actionType,
      actorId: actorId.toNumber(),
    });
    return row ? this.toDomain(row) : null;
  }

  async findOneByActorThisGame(
    gameId: GameId,
    actorId: PlayerId,
    actionType: GameActionType,
  ): Promise<GameAction | null> {
    const row = await this.repo.findOneBy({
      gameId: gameId.toNumber(),
      actorId: actorId.toNumber(),
      actionType,
    });
    return row ? this.toDomain(row) : null;
  }

  async findOneOfTypeThisTurn(
    gameId: GameId,
    dayNumber: number,
    actionType: GameActionType,
  ): Promise<GameAction | null> {
    const row = await this.repo.findOneBy({
      gameId: gameId.toNumber(),
      dayNumber,
      actionType,
    });
    return row ? this.toDomain(row) : null;
  }

  async findAllByActor(
    gameId: GameId,
    actorId: PlayerId,
    actionTypes: GameActionType[],
  ): Promise<GameAction[]> {
    const rows = await this.repo.find({
      where: {
        gameId: gameId.toNumber(),
        actorId: actorId.toNumber(),
        actionType: In(actionTypes),
      },
      order: { dayNumber: 'ASC' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async record(action: GameAction): Promise<void> {
    try {
      await this.repo.insert({
        gameId: action.gameId,
        dayNumber: action.dayNumber,
        actionType: action.actionType,
        actorId: action.actorId.toNumber(),
        targetId: action.targetId.toNumber(),
        result: action.result,
      });
    } catch (err) {
      if ((err as { code?: string })?.code === '23505') {
        throw new SkillAlreadyUsedError('Bạn đã dùng kỹ năng này rồi');
      }
      throw err;
    }
  }

  private toDomain(row: GameActionOrmEntity): GameAction {
    return GameAction.reconstitute({
      gameId: row.gameId,
      dayNumber: row.dayNumber,
      actionType: row.actionType,
      actorId: PlayerId.of(row.actorId),
      targetId: PlayerId.of(row.targetId),
      result: row.result,
      createdAt: row.createdAt,
    });
  }
}
