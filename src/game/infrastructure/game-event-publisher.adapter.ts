import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GameEventPublisher } from '../application/ports/game-event-publisher';

// Gateway — implement GameEventPublisher bằng EventEmitter2. Tên event/payload giữ nguyên
// 100% so với game.service.ts cũ — RoomsModule không cần đổi gì để tiếp tục lắng nghe.
@Injectable()
export class GameEventPublisherAdapter implements GameEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  gameFinished(roomId: number): void {
    this.eventEmitter.emit('game.finished', { roomId });
  }

  gameStartFailed(roomId: number, reason: string): void {
    this.eventEmitter.emit('game.start_failed', { roomId, reason });
  }
}
