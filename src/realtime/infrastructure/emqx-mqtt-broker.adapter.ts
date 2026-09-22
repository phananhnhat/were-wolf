import { Injectable, Logger as NestLogger } from '@nestjs/common';
import { MqttBroker } from './mqtt-broker.interface';

// Gateway — EMQX (broker MQTT chạy NGOÀI process NestJS, giai đoạn 2 của PLAN-REALTIME.md, xem
// docker-compose.yml service `emqx` + emqx/emqx.conf). Không có gì để mở trong process này —
// EMQX tự nghe TCP/WS, tự verify JWT (authentication chain trong emqx.conf), và tự gọi ngược
// vào MqttAuthorizeController (mqtt-authorize.controller.ts) mỗi lần client SUBSCRIBE để hỏi
// "userId này có phải thành viên phòng roomId không" — đúng logic AedesMqttBrokerAdapter làm
// TRONG process ở giai đoạn 1, chỉ khác cơ chế gọi (hook JS vs HTTP webhook).
//
// `implements MqttBroker` — cùng hợp đồng với AedesMqttBrokerAdapter, nên đổi broker chỉ cần
// đổi provider ở realtime.module.ts, không đổi gì ở GameModule/use case nào.
@Injectable()
export class EmqxMqttBrokerAdapter implements MqttBroker {
  private readonly logger = new NestLogger(EmqxMqttBrokerAdapter.name);

  onModuleInit(): void {
    this.logger.log(
      'Dùng EMQX ngoài (docker-compose service `emqx`) — không khởi động gì trong process này.',
    );
  }

  onModuleDestroy(): void {
    // Không có socket/connection nào của process này cần đóng — EMQX tự quản vòng đời của nó.
  }
}
