import { GameStateView } from '../read-models/game-state.read-model';

export interface LynchVoteTallyPayload {
  gameId: number;
  dayNumber: number;
  tally: Array<{ targetUserId: number; count: number }>;
}

// PORT — đẩy trạng thái ván tới client đang mở ván đó theo thời gian thực, qua MQTT (Aedes ở
// giai đoạn 1, EMQX ở giai đoạn 2 — xem PLAN-REALTIME.md). CHỈ 1 chiều server → client: hành
// động (vote/soi/che/đầu độc/cứu) vẫn 100% qua REST như cũ, port này không nhận gì từ client.
// Domain/Application không biết `mqtt`/`aedes` tồn tại — implementation thật ở Infrastructure
// layer (mqtt-realtime-game-publisher.adapter.ts).
export interface RealtimeGamePublisher {
  // Retained trên broker — client vừa subscribe (mới vào ván, hoặc vừa reconnect) nhận ngay
  // state hiện tại mà không phải chờ sự kiện tiếp theo.
  publishState(roomId: number, state: GameStateView): void;

  // Retained — tally treo cổ công khai, ai trong ván cũng xem được (đúng luật REST hiện có ở
  // getVoteTally(..., { wolfOnly: false })).
  publishLynchVotes(roomId: number, payload: LynchVoteTallyPayload): void;

  // KHÔNG retained, KHÔNG mang dữ liệu — chỉ báo "Sói vừa đổi phiếu cắn". Client (biết mình là
  // Sói qua getMyState riêng tư) tự gọi lại GET /games/:gameId/wolf/votes để lấy tally thật —
  // lý do không đẩy thẳng tally Sói qua MQTT: xem PLAN-REALTIME.md mục 7.
  pingWolfVotes(roomId: number, gameId: number, dayNumber: number): void;
}

export const REALTIME_GAME_PUBLISHER = Symbol('REALTIME_GAME_PUBLISHER');
