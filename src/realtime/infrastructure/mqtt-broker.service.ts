import {
  Inject,
  Injectable,
  Logger as NestLogger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as net from 'node:net';
import { WebSocketServer, createWebSocketStream } from 'ws';
import type { Aedes as AedesInstance, AedesOptions } from 'aedes';
import { ROOM_MEMBERSHIP_READER } from '../application/ports/room-membership-reader';
import type { RoomMembershipReader } from '../application/ports/room-membership-reader';
import { parseRoomIdFromTopic } from '../topics';

// Username cố định dùng để MqttRealtimeGamePublisherAdapter (GameModule) tự connect vào broker
// — KHÔNG phải end-user, không có access token thật. Xem PLAN-REALTIME.md mục 5.1.
const INTERNAL_PUBLISHER_USERNAME = 'internal-publisher';

interface AccessTokenPayload {
  sub: number; // userId — không import TokenPayload thật của AuthModule, xem PLAN-REALTIME.md:
  // đây là kiểu dữ liệu cục bộ của RealtimeModule, chỉ đọc đúng field cần dùng.
}

// Gateway — Aedes (broker MQTT embedded ngay trong process NestJS, giai đoạn 1 của
// PLAN-REALTIME.md). Mở 1 listener TCP (mobile/native) + 1 listener WebSocket (browser) trên
// cùng 1 instance Aedes, và tự làm luôn 2 việc mà ở giai đoạn 2 (EMQX) do broker ngoài + webhook
// HTTP đảm nhiệm:
//   - authenticate  → verify access token (JWT_ACCESS_SECRET dùng chung với AuthModule)
//   - authorizeSubscribe → chỉ cho subscribe đúng phòng mà userId đang là thành viên
// `aedes` là gói thuần ESM (package.json "type": "module") trong khi project này compile ra
// CommonJS — import động (`await import('aedes')`) để không vướng lỗi TS/Node khi 1 file CJS
// `import` tĩnh 1 gói chỉ có bản ESM; các type vẫn import tĩnh bình thường (`import type`
// không sinh ra require()/import nào lúc build nên không bị ảnh hưởng).
@Injectable()
export class MqttBrokerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new NestLogger(MqttBrokerService.name);

  private readonly userIdByClientId = new Map<string, number>();
  private readonly internalPublisherClientIds = new Set<string>();

  private aedes: AedesInstance | null = null;
  private tcpServer: net.Server | null = null;
  private wsServer: WebSocketServer | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    @Inject(ROOM_MEMBERSHIP_READER)
    private readonly roomMembership: RoomMembershipReader,
  ) {}

  async onModuleInit(): Promise<void> {
    const { Aedes } = await import('aedes');

    const options: AedesOptions = {
      authenticate: this.authenticate,
      authorizeSubscribe: this.authorizeSubscribe,
      authorizePublish: this.authorizePublish,
    };
    this.aedes = await Aedes.createBroker(options);

    this.aedes.on('clientDisconnect', (client) => {
      this.userIdByClientId.delete(client.id);
      this.internalPublisherClientIds.delete(client.id);
    });

    const tcpPort = Number(this.config.get('MQTT_TCP_PORT') ?? 1883);
    this.tcpServer = net.createServer(this.aedes.handle);
    await new Promise<void>((resolve) =>
      this.tcpServer!.listen(tcpPort, resolve),
    );
    this.logger.log(`MQTT (Aedes) TCP listener trên cổng ${tcpPort}`);

    const wsPort = Number(this.config.get('MQTT_WS_PORT') ?? 8083);
    this.wsServer = new WebSocketServer({ port: wsPort });
    this.wsServer.on('connection', (socket, req) => {
      const stream = createWebSocketStream(socket);
      this.aedes!.handle(stream, req);
    });
    this.logger.log(`MQTT (Aedes) WS listener trên cổng ${wsPort}`);
  }

  onModuleDestroy(): void {
    this.wsServer?.close();
    this.tcpServer?.close();
    this.aedes?.close();
  }

  // CONNECT — 2 nhánh: (1) chính MqttRealtimeGamePublisherAdapter của backend tự connect bằng
  // username/password nội bộ; (2) client thật (web/mobile) connect bằng username 'jwt',
  // password = access token hiện có (JWT_ACCESS_SECRET dùng chung với AuthModule).
  private readonly authenticate: NonNullable<AedesOptions['authenticate']> = (
    client,
    username,
    password,
    done,
  ) => {
    if (username === INTERNAL_PUBLISHER_USERNAME) {
      const expected = this.config.get<string>('MQTT_INTERNAL_PASSWORD');
      const ok = Boolean(expected) && password?.toString() === expected;
      if (ok) this.internalPublisherClientIds.add(client.id);
      done(null, ok);
      return;
    }

    try {
      const payload = this.jwtService.verify<AccessTokenPayload>(
        password?.toString() ?? '',
        { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET') },
      );
      this.userIdByClientId.set(client.id, payload.sub);
      done(null, true);
    } catch {
      done(null, false); // token sai/hết hạn — từ chối CONNECT
    }
  };

  // SUBSCRIBE — chỉ cho subscribe đúng topic của 1 phòng mà chính client đang là thành viên
  // (PLAN-REALTIME.md mục 4, mục 5.1). Deny-by-default: topic không khớp mẫu
  // ww/room/{roomId}/... hoặc client chưa xác thực (chưa có trong userIdByClientId — trường
  // hợp chính adapter nội bộ lỡ gọi subscribe, nó không cần và không nên subscribe gì) đều bị
  // từ chối.
  private readonly authorizeSubscribe: NonNullable<
    AedesOptions['authorizeSubscribe']
  > = async (client, sub, callback) => {
    const roomId = parseRoomIdFromTopic(sub.topic);
    const userId = this.userIdByClientId.get(client.id);
    if (roomId === null || userId === undefined) {
      callback(null, null);
      return;
    }

    try {
      const allowed = await this.roomMembership.isRoomMember(userId, roomId);
      callback(null, allowed ? sub : null);
    } catch (err) {
      this.logger.error(
        'Lỗi kiểm tra quyền subscribe MQTT',
        err instanceof Error ? err.stack : undefined,
      );
      callback(null, null);
    }
  };

  // PUBLISH — chỉ chính backend (qua MqttRealtimeGamePublisherAdapter, xác thực bằng nhánh
  // internal-publisher ở authenticate) mới được publish. Đúng nguyên tắc "MQTT chỉ đẩy trạng
  // thái, client không publish" đã chốt ở PLAN-REALTIME.md mục 0 — chặn luôn ở broker, không chỉ
  // dựa vào việc client "tự giác" không gọi publish().
  private readonly authorizePublish: NonNullable<
    AedesOptions['authorizePublish']
  > = (client, _packet, callback) => {
    if (client && this.internalPublisherClientIds.has(client.id)) {
      callback();
      return;
    }
    callback(
      new Error('Client không được publish — mọi trạng thái chỉ do server đẩy'),
    );
  };
}
