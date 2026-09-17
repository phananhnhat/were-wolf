import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Game as GameOrmEntity } from '../entities/game.entity';
import { GamePlayer as GamePlayerOrmEntity } from '../entities/game-player.entity';
import { GameVote as GameVoteOrmEntity } from '../entities/game-vote.entity';
import { GameAction as GameActionOrmEntity } from '../entities/game-action.entity';
import {
  GameUnitOfWork,
  GameTransactionalRepositories,
} from '../application/ports/game-unit-of-work';
import { TypeOrmGameRepository } from './persistence/typeorm-game.repository';
import { TypeOrmGamePlayerRepository } from './persistence/typeorm-game-player.repository';
import { TypeOrmGameVoteRepository } from './persistence/typeorm-game-vote.repository';
import { TypeOrmGameActionRepository } from './persistence/typeorm-game-action.repository';

// Gateway — implement GameUnitOfWork bằng DataSource.transaction() của TypeORM. Tạo 4
// repository adapter MỚI, mỗi cái bọc Repository<T> lấy từ EntityManager của giao dịch
// (manager.getRepository(...)) — y hệt cách game.service.ts cũ dùng `manager.getRepository(X)`
// bên trong dataSource.transaction().
@Injectable()
export class TypeOrmGameUnitOfWork implements GameUnitOfWork {
  constructor(private readonly dataSource: DataSource) {}

  runInTransaction<T>(
    work: (repos: GameTransactionalRepositories) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction((manager) =>
      work({
        games: new TypeOrmGameRepository(manager.getRepository(GameOrmEntity)),
        players: new TypeOrmGamePlayerRepository(
          manager.getRepository(GamePlayerOrmEntity),
        ),
        votes: new TypeOrmGameVoteRepository(
          manager.getRepository(GameVoteOrmEntity),
        ),
        actions: new TypeOrmGameActionRepository(
          manager.getRepository(GameActionOrmEntity),
        ),
      }),
    );
  }
}
