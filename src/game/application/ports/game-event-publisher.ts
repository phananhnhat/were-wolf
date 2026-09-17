// PORT — phát sự kiện tích hợp RA NGOÀI GameModule, để RoomsModule phản ứng (đưa phòng về
// WAITING khi ván xong, hoặc rollback status khi tạo ván thất bại). Tương đương 2 event
// 'game.finished'/'game.start_failed' mà game.service.ts hiện phát qua EventEmitter2.
// Implementation thật ở Infrastructure layer.
export interface GameEventPublisher {
  gameFinished(roomId: number): void;
  gameStartFailed(roomId: number, reason: string): void;
}

export const GAME_EVENT_PUBLISHER = Symbol('GAME_EVENT_PUBLISHER');
