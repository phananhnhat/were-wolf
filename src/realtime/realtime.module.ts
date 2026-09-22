import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomMember } from '../rooms/entities/room-member.entity';
import { ROOM_MEMBERSHIP_READER } from './application/ports/room-membership-reader';
import { TypeOrmRoomMembershipReader } from './infrastructure/typeorm-room-membership-reader';
import { EmqxMqttBrokerAdapter } from './infrastructure/emqx-mqtt-broker.adapter';
// import { AedesMqttBrokerAdapter } from './infrastructure/aedes-mqtt-broker.adapter'; // Giai
// đoạn 1 — đổi lại provider dưới đây (+ xoá controllers) để quay về Aedes embedded, không cần
// sửa gì ở GameModule hay use case nào. Xem PLAN-REALTIME.md mục 3.
import { MqttAuthorizeController } from './mqtt-authorize.controller';

// Hạ tầng realtime dùng chung, không thuộc riêng GameModule (nếu sau này có tính năng realtime
// khác ngoài game cũng dùng chung broker này) — xem PLAN-REALTIME.md mục 6.
//
// Đổi broker = đổi ĐÚNG dòng provider dưới đây (`AedesMqttBrokerAdapter` ↔
// `EmqxMqttBrokerAdapter`, cả 2 cùng implement `MqttBroker` — xem
// infrastructure/mqtt-broker.interface.ts) và bật/tắt `controllers` (webhook chỉ EMQX cần gọi
// tới, Aedes tự làm trong process nên không cần). Không cần đổi gì ở `ROOM_MEMBERSHIP_READER` —
// cả 2 giai đoạn dùng lại nguyên logic kiểm quyền đó, chỉ khác cơ chế gọi (hook JS vs HTTP). Đã
// verify thật: chạy đúng 1 bộ test MQTT e2e (.mqtt-emqx-e2e.cjs lúc phát triển) nhắm vào cả 2
// giai đoạn, đổi provider ở đây là thay đổi DUY NHẤT cần làm.
@Module({
  imports: [
    TypeOrmModule.forFeature([RoomMember]),
    JwtModule.register({}), // luôn truyền secret tường minh per-call, giống AuthModule
  ],
  controllers: [MqttAuthorizeController],
  providers: [
    { provide: ROOM_MEMBERSHIP_READER, useClass: TypeOrmRoomMembershipReader },
    EmqxMqttBrokerAdapter,
  ],
})
export class RealtimeModule {}
