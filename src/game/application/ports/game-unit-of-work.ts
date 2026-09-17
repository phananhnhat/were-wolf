import { GameRepository } from '../../domain/repositories/game.repository';
import { GamePlayerRepository } from '../../domain/repositories/game-player.repository';
import { GameVoteRepository } from '../../domain/repositories/game-vote.repository';
import { GameActionRepository } from '../../domain/repositories/game-action.repository';

// Các repository CÙNG chạy trong 1 giao dịch — dùng bên trong runInTransaction() để đọc/ghi
// nhiều bảng nguyên tử (vd. tạo Game + chia GamePlayer, hoặc đánh dấu chết + chuyển pha).
export interface GameTransactionalRepositories {
  games: GameRepository;
  players: GamePlayerRepository;
  votes: GameVoteRepository;
  actions: GameActionRepository;
}

// PORT — giao dịch. Chỉ 2 use case cần: StartGameUseCase (tạo ván + chia vai) và
// AdvanceGameUseCase (đánh dấu chết + chuyển pha/kết thúc ván) — 2 chỗ duy nhất
// game.service.ts hiện dùng dataSource.transaction(). Implementation thật (TypeORM) ở
// Infrastructure layer.
export interface GameUnitOfWork {
  runInTransaction<T>(
    work: (repos: GameTransactionalRepositories) => Promise<T>,
  ): Promise<T>;
}

export const GAME_UNIT_OF_WORK = Symbol('GAME_UNIT_OF_WORK');
