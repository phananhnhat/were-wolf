import {
  Injectable,
  Logger as NestLogger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, MqttClient } from 'mqtt';
import {
  RealtimeGamePublisher,
  LynchVoteTallyPayload,
} from '../application/ports/realtime-game-publisher';
import { GameStateView } from '../application/read-models/game-state.read-model';
import {
  roomStateTopic,
  roomLynchVotesTopic,
  roomWolfVotesPingTopic,
} from '../../realtime/topics';

// Username cố định dùng riêng cho backend tự connect vào broker — phải khớp
// INTERNAL_PUBLISHER_USERNAME ở realtime/infrastructure/mqtt-broker.service.ts (giai đoạn 1) /
// credential cấu hình trong EMQX (giai đoạn 2). Xem PLAN-REALTIME.md mục 5.1.
const INTERNAL_PUBLISHER_USERNAME = 'internal-publisher';

// Gateway — implement RealtimeGamePublisher bằng `mqtt` npm client. Publish vào
// `mqtt://localhost:1883` (Aedes, giai đoạn 1) hay `mqtt://emqx:1883` (EMQX, giai đoạn 2) đều
// cùng 1 dòng code, chỉ khác biến môi trường MQTT_URL — xem PLAN-REALTIME.md mục 3.2.
// Domain/Application không biết `mqtt` tồn tại.
@Injectable()
export class MqttRealtimeGamePublisherAdapter
  implements RealtimeGamePublisher, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new NestLogger(
    MqttRealtimeGamePublisherAdapter.name,
  );
  private client: MqttClient | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.config.get<string>('MQTT_URL') ?? 'mqtt://localhost:1883';
    this.client = connect(url, {
      username: INTERNAL_PUBLISHER_USERNAME,
      password: this.config.get<string>('MQTT_INTERNAL_PASSWORD'),
    });
    this.client.on('error', (err) => {
      this.logger.error('Lỗi kết nối MQTT broker', err.stack);
    });
  }

  onModuleDestroy(): void {
    this.client?.end();
  }

  publishState(roomId: number, state: GameStateView): void {
    this.publish(roomStateTopic(roomId), state, true);
  }

  publishLynchVotes(roomId: number, payload: LynchVoteTallyPayload): void {
    this.publish(roomLynchVotesTopic(roomId), payload, true);
  }

  pingWolfVotes(roomId: number, gameId: number, dayNumber: number): void {
    this.publish(roomWolfVotesPingTopic(roomId), { gameId, dayNumber }, false);
  }

  private publish(topic: string, payload: unknown, retain: boolean): void {
    // Broker chưa kịp connect xong (chỉ có thể xảy ra ngay lúc app vừa boot) — bỏ qua, không
    // throw, vì đây là kênh "tăng tốc", không phải nguồn sự thật (REST vẫn luôn đúng, xem
    // PLAN-REALTIME.md mục 1).
    if (!this.client) return;
    this.client.publish(
      topic,
      JSON.stringify(payload),
      { qos: 1, retain },
      (err) => {
        if (err) {
          this.logger.error(
            `Publish MQTT thất bại (topic ${topic})`,
            err.stack,
          );
        }
      },
    );
  }
}
