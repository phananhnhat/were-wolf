import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomMember } from '../rooms/entities/room-member.entity';
import { ROOM_MEMBERSHIP_READER } from './application/ports/room-membership-reader';
import { TypeOrmRoomMembershipReader } from './infrastructure/typeorm-room-membership-reader';
import { MqttBrokerService } from './infrastructure/mqtt-broker.service';

// Hạ tầng realtime dùng chung, không thuộc riêng GameModule (nếu sau này có tính năng realtime
// khác ngoài game cũng dùng chung broker này) — xem PLAN-REALTIME.md mục 6.
//
// Giai đoạn 1 (hiện tại): MqttBrokerService tự chạy broker Aedes embedded trong process này.
// Giai đoạn 2 (EMQX, sau này): MqttBrokerService bị xoá, module này chỉ còn cung cấp
// ROOM_MEMBERSHIP_READER cho endpoint webhook `/internal/mqtt/authorize` mới — không phải viết
// lại logic kiểm quyền, xem PLAN-REALTIME.md mục 5.
@Module({
  imports: [
    TypeOrmModule.forFeature([RoomMember]),
    JwtModule.register({}), // luôn truyền secret tường minh per-call, giống AuthModule
  ],
  providers: [
    { provide: ROOM_MEMBERSHIP_READER, useClass: TypeOrmRoomMembershipReader },
    MqttBrokerService,
  ],
})
export class RealtimeModule {}
