import { Body, Controller, Headers, Inject, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/decorators/public.decorator';
import { ROOM_MEMBERSHIP_READER } from './application/ports/room-membership-reader';
import type { RoomMembershipReader } from './application/ports/room-membership-reader';
import { INTERNAL_PUBLISHER_USERNAME, parseRoomIdFromTopic } from './topics';
import { MqttAuthorizeDto } from './dto/mqtt-authorize.dto';

// Webhook nội bộ EMQX gọi lúc SUBSCRIBE (authorization type http trong emqx/emqx.conf) — thay
// cho hook `authorizeSubscribe` trong process của AedesMqttBrokerAdapter (giai đoạn 1), vì EMQX
// chạy ngoài process nên không gọi hàm JS trực tiếp được, phải qua HTTP. Logic bên trong GIỐNG
// HỆT: parse roomId từ topic rồi hỏi RoomMembershipReader — không viết lại gì.
//
// Khác Aedes 1 chỗ: EMQX áp CÙNG 1 webhook `authorization` cho cả SUBSCRIBE lẫn PUBLISH (không
// tách riêng như `authorizeSubscribe`/`authorizePublish` của Aedes) — EMQX gửi kèm field
// "action" để tự phân biệt: PUBLISH chỉ cho phép đúng username "internal-publisher" (backend,
// đã xác thực riêng ở CONNECT bằng MQTT_INTERNAL_PASSWORD — xem emqx/emqx.conf, authenticator
// built_in_database); SUBSCRIBE thì kiểm theo thành viên phòng như bình thường.
//
// @Public() để qua JwtAuthGuard global (EMQX gọi server-to-server, không có access token của
// user nào trong request này) — an toàn nhờ MQTT_AUTHZ_SECRET, và endpoint chỉ ĐỌC, không ghi
// gì, xem PLAN-REALTIME.md mục 5.2.
//
// Dùng @Res() thay vì throw HttpException — xác nhận qua log thật: EMQX's HTTP authorization
// KHÔNG chỉ nhìn status code, nó cần body dạng "allow"/"deny" (content-type: text/plain) để
// biết cách hiểu response; 200 rỗng hay 403 rỗng đều bị coi là không hiểu được, rơi về
// `authorization.no_match` (deny mặc định) — không phải do request bị từ chối đúng nghĩa.
@Controller('internal/mqtt')
export class MqttAuthorizeController {
  constructor(
    private readonly config: ConfigService,
    @Inject(ROOM_MEMBERSHIP_READER)
    private readonly roomMembership: RoomMembershipReader,
  ) {}

  @Public()
  @Post('authorize')
  async authorize(
    @Headers('x-internal-secret') secret: string | undefined,
    @Body() dto: MqttAuthorizeDto,
    @Res() res: Response,
  ): Promise<void> {
    if (secret !== this.config.getOrThrow<string>('MQTT_AUTHZ_SECRET')) {
      this.reply(res, false);
      return;
    }

    // Chỉ chính backend (username = internal-publisher, đã qua authenticator riêng ở CONNECT —
    // xem emqx/emqx.conf) được publish; publish từ bất kỳ ai khác đều bị chặn ở đây, dù họ có
    // là thành viên phòng đi nữa — đúng nguyên tắc "MQTT chỉ đẩy trạng thái, client không
    // publish" (PLAN-REALTIME.md mục 0).
    if (dto.action === 'publish') {
      this.reply(res, dto.userId === INTERNAL_PUBLISHER_USERNAME);
      return;
    }

    const roomId = parseRoomIdFromTopic(dto.topic);
    if (roomId === null) {
      this.reply(res, false);
      return;
    }

    const allowed = await this.roomMembership.isRoomMember(
      Number(dto.userId),
      roomId,
    );
    this.reply(res, allowed);
  }

  private reply(res: Response, allowed: boolean): void {
    // "text/plain" (có hay không kèm charset) đều bị EMQX báo "unsupported content-type" —
    // xác nhận qua log thật (bad_authz_http_response). application/json + {"result": "allow"}
    // mới đúng format EMQX chấp nhận.
    res.status(200).json({ result: allowed ? 'allow' : 'deny' });
  }
}
