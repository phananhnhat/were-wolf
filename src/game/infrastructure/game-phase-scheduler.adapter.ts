import { Injectable, Logger as NestLogger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { SchedulerRegistry } from '@nestjs/schedule';
import { GameId } from '../domain/value-objects/game-id.vo';
import { GamePhaseScheduler } from '../application/ports/game-phase-scheduler';
import {
  AdvanceGameUseCase,
  ADVANCE_GAME_USE_CASE,
} from '../application/use-cases/advance-game.use-case';

// Gateway — implement GamePhaseScheduler bằng SchedulerRegistry của @nestjs/schedule. Logic
// schedule()/cancel() y hệt schedulePhase()/cancelPhase() cũ trong game.service.ts.
//
// AdvanceGameUseCase cần GamePhaseScheduler (để tự hẹn lịch pha kế tiếp), nhưng khi hết giờ,
// chính adapter này lại cần gọi ngược lại AdvanceGameUseCase.execute() — vòng lặp constructor
// kinh điển. Giải quyết bằng ModuleRef + OnModuleInit: lấy AdvanceGameUseCase LƯỜI, sau khi cả
// module đã khởi tạo xong, không qua constructor. Xem CLEAN-ARCHITECTURE.md.
@Injectable()
export class GamePhaseSchedulerAdapter
  implements GamePhaseScheduler, OnModuleInit
{
  private readonly logger = new NestLogger(GamePhaseSchedulerAdapter.name);
  private advanceGameUseCase!: AdvanceGameUseCase;

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit(): void {
    this.advanceGameUseCase = this.moduleRef.get(ADVANCE_GAME_USE_CASE, {
      strict: false,
    });
  }

  schedule(gameId: GameId, durationMs: number): void {
    this.cancel(gameId); // mỗi ván chỉ giữ đúng 1 timer
    const timeout = setTimeout(() => {
      this.cancel(gameId); // dọn khỏi registry trước khi chạy
      this.advanceGameUseCase.execute(gameId.toNumber()).catch((err) => {
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
