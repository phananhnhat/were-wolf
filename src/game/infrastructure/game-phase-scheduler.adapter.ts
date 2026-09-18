import { Inject, Injectable, Logger as NestLogger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { GameId } from '../domain/value-objects/game-id.vo';
import { GamePhaseScheduler } from '../application/ports/game-phase-scheduler';
import { GAME_UNIT_OF_WORK } from '../application/ports/game-unit-of-work';
import { GAME_EVENT_PUBLISHER } from '../application/ports/game-event-publisher';
import { REALTIME_GAME_PUBLISHER } from '../application/ports/realtime-game-publisher';
import { advanceGame } from '../application/use-cases/advance-game.use-case';

// import type — xem ghi chú ở game.service.ts (TS1272: @Inject() cần type constructor param
// không tồn tại lúc runtime).
import type { GameUnitOfWork } from '../application/ports/game-unit-of-work';
import type { GameEventPublisher } from '../application/ports/game-event-publisher';
import type { RealtimeGamePublisher } from '../application/ports/realtime-game-publisher';

// Gateway — implement GamePhaseScheduler bằng SchedulerRegistry của @nestjs/schedule. Logic
// schedule()/cancel() y hệt schedulePhase()/cancelPhase() cũ trong game.service.ts.
//
// Từ khi advanceGame() (Application layer) trở thành HÀM thuần thay vì class, vòng lặp phụ
// thuộc "AdvanceGameUseCase cần GamePhaseScheduler, GamePhaseScheduler cần gọi lại
// AdvanceGameUseCase" không còn tồn tại nữa: adapter này TỰ LÀ GamePhaseScheduler (chính
// `this`), nên có thể gọi advanceGame(unitOfWork, this, eventPublisher, gameId) trực tiếp mà
// không cần nhờ NestJS "tiêm" một instance riêng — không cần ModuleRef/OnModuleInit như bản
// dùng class trước đây.
@Injectable()
export class GamePhaseSchedulerAdapter implements GamePhaseScheduler {
  private readonly logger = new NestLogger(GamePhaseSchedulerAdapter.name);

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(GAME_UNIT_OF_WORK) private readonly unitOfWork: GameUnitOfWork,
    @Inject(GAME_EVENT_PUBLISHER)
    private readonly eventPublisher: GameEventPublisher,
    @Inject(REALTIME_GAME_PUBLISHER)
    private readonly realtime: RealtimeGamePublisher,
  ) {}

  schedule(gameId: GameId, durationMs: number): void {
    this.cancel(gameId); // mỗi ván chỉ giữ đúng 1 timer
    const timeout = setTimeout(() => {
      this.cancel(gameId); // dọn khỏi registry trước khi chạy
      advanceGame(
        this.unitOfWork,
        this,
        this.eventPublisher,
        this.realtime,
        gameId.toNumber(),
      ).catch((err) => {
        this.logger.error(
          `Lỗi khi tự động chuyển pha cho game #${gameId.toNumber()}`,
          err instanceof Error ? err.stack : undefined,
        );
      });
    }, durationMs);
    this.schedulerRegistry.addTimeout(this.timerName(gameId), timeout);
  }

  cancel(gameId: GameId): void {
    const name = this.timerName(gameId);
    if (this.schedulerRegistry.doesExist('timeout', name)) {
      this.schedulerRegistry.deleteTimeout(name); // tự gọi clearTimeout bên trong
    }
  }

  private timerName(gameId: GameId): string {
    return `game-phase-${gameId.toNumber()}`;
  }
}
