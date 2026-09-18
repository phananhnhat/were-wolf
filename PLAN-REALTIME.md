# PLAN-REALTIME — Realtime cho ván chơi qua MQTT

Phương án triển khai realtime (đẩy trạng thái ván tới client ngay khi thay đổi, thay vì client
phải poll `GET /games/room/:roomId`). **Chưa triển khai** — tài liệu này là bản thiết kế để bàn
trước khi viết code.

Cập nhật: 2026-09-18

---

## 0. Quyết định đã chốt

| Câu hỏi | Quyết định |
|---|---|
| Broker host ở đâu | **2 giai đoạn**: Giai đoạn 1 (hiện tại) — **Aedes**, chạy **embedded trong chính process NestJS** (không phải service riêng), để hoàn thiện logic BE (topic, port/adapter, nơi gọi publish) trước, không tốn công dựng hạ tầng ngay. Giai đoạn 2 (sau) — thay bằng **self-host EMQX** qua `docker-compose.yml`. Chi tiết đánh đổi + đường chuyển ở mục 3 |
| Phạm vi MQTT | **Chỉ đẩy trạng thái** (server → client). Mọi hành động (vote, soi, che, đầu độc, cứu...) **vẫn qua REST** như hiện tại — không đụng vào `JwtAuthGuard` + `ValidationPipe` + luật Domain layer đã có |
| Client | **Cả web browser lẫn mobile/native** → broker cần bật cả listener MQTT-over-WebSocket lẫn TCP/TLS thường |

> **Aedes chỉ là lựa chọn tạm cho giai đoạn phát triển BE, KHÔNG dùng cho production.** Lý do và
> giới hạn cụ thể ở mục 3 và mục 11 — quan trọng nhất: Aedes chạy trong bộ nhớ của **một process
> duy nhất**, không tự fan-out được giữa nhiều instance NestJS (không có tính năng cluster/shared
> persistence như EMQX) — chấp nhận được lúc dev (1 instance `start:dev`), không chấp nhận được
> lúc chạy nhiều instance thật.

Hệ quả của việc "chỉ đẩy trạng thái": không cần thiết kế lại auth cho chiều client→server qua
MQTT, không cần validate DTO/domain rule trên đường MQTT — toàn bộ phần khó (auth hành động) đã
có sẵn ở REST, MQTT chỉ là một "loa phát" thêm cho những gì REST vẫn luôn là nguồn sự thật.

---

## 1. Vì sao vẫn cần realtime nếu REST đã đủ đúng

REST hiện tại đã **đúng** (state được tính lại từ DB mỗi lần gọi), vấn đề là **chậm**: client
phải tự poll `GET /games/room/:roomId` mỗi vài giây để biết pha đã đổi chưa, ai vừa chết, ai vừa
thắng. Với thời lượng mỗi pha tính bằng giây (xem `PHASE_DURATION_MS`), poll interval ngắn vừa
tốn tải server vừa vẫn có độ trễ vài giây. Mục tiêu realtime: server chủ động đẩy state **ngay
khi** nó đổi, độ trễ còn cỡ mạng, không còn phụ thuộc chu kỳ poll.

**Nguyên tắc giữ nguyên**: MQTT không thay thế REST làm nguồn sự thật. Client vẫn `GET
/games/room/:roomId` khi vào ván lần đầu / lúc reconnect để lấy state chắc chắn đúng, rồi mới
subscribe MQTT để nhận cập nhật tiếp theo. Nếu mất kết nối MQTT, retained message + REST fallback
đảm bảo không có state nào bị "lạc" vĩnh viễn (xem mục 5).

---

## 2. Kiến trúc tổng quan

### Giai đoạn 1 (hiện tại) — Aedes embedded trong process NestJS

```
┌──────────────┐   REST (hành động: vote/soi/che/đầu độc/cứu, có JwtAuthGuard)   ┌───────────────────────────┐
│  Client      │ ───────────────────────────────────────────────────────────▶  │  NestJS process           │
│ (web/mobile) │                                                                │  ┌──────────────────────┐ │
│              │   MQTT SUBSCRIBE (chỉ nhận state, không publish)               │  │ HTTP (Express, cổng  │ │
│              │ ◀───────────────────────────────┐                             │  │ 3000, như hiện tại)  │ │
└──────┬───────┘                                  │                             │  └──────────────────────┘ │
       │ CONNECT (JWT access token làm password)  │                             │  ┌──────────────────────┐ │
       │ TCP :1883 (mobile) / WS :8083 (browser)  └────────────────────────────▶│  │ Aedes broker         │ │
       ▼                                                                        │  │ (net.Server + ws,    │ │
                                                                                 │  │  cùng 1 process)     │ │
                                                                                 │  │ - authenticate()     │ │
                                                                                 │  │ - authorizeSubscribe()│ │
                                                                                 │  │   gọi THẲNG service  │ │
                                                                                 │  │   NestJS, không qua  │ │
                                                                                 │  │   HTTP webhook       │ │
                                                                                 │  └──────────▲───────────┘ │
                                                                                 │             │ publish     │
                                                                                 │  ┌──────────┴───────────┐ │
                                                                                 │  │ RealtimeGamePublisher │ │
                                                                                 │  │ adapter (mqtt client, │ │
                                                                                 │  │ connect localhost)    │ │
                                                                                 │  └───────────────────────┘ │
                                                                                 └───────────────────────────┘
```

Vì Aedes chạy **trong cùng process** NestJS, hook `authorizeSubscribe` không cần gọi HTTP ra
ngoài như thiết kế EMQX (mục 5 cũ) — nó là 1 hàm JS gọi thẳng vào provider NestJS đang có sẵn
trong cùng bộ nhớ (vd. kiểm tra `RoomMember`). Đây là điểm khác biệt lớn nhất so với giai đoạn 2.

### Giai đoạn 2 (sau này) — EMQX là service riêng

```
┌──────────────┐   REST (hành động: vote/soi/che/đầu độc/cứu, có JwtAuthGuard)   ┌──────────────┐
│  Client      │ ───────────────────────────────────────────────────────────▶  │  NestJS API  │
│ (web/mobile) │                                                                │  (như hiện   │
│              │   MQTT SUBSCRIBE (chỉ nhận state, không publish)               │   tại)       │
│              │ ◀──────────────────────────────────────────────────────────── │              │
└──────┬───────┘                                                                └──────┬───────┘
       │ CONNECT (JWT access token làm password)                                        │ PUBLISH
       │ SUBSCRIBE ww/room/{roomId}/...                                                  │ (khi state đổi,
       ▼                                                                                 │  sau khi transaction
┌─────────────────────────────────────────────────────────────────────────┐             │  commit)
│  EMQX (docker-compose, service riêng, cùng mạng với postgres)           │◀────────────┘
│  - Listener TCP 1883 (mobile/native)                                    │
│  - Listener WS 8083 / WSS 8084 (browser)                                │
│  - Authentication: JWT (chung JWT_ACCESS_SECRET với NestJS)             │
│  - Authorization: HTTP webhook gọi ngược vào NestJS lúc SUBSCRIBE       │──── POST /internal/mqtt/authorize ──▶ NestJS
│    (kiểm tra userId có phải thành viên phòng roomId không)              │
└─────────────────────────────────────────────────────────────────────────┘
```

**Điểm quan trọng nhất của thiết kế**: phần **không đổi** giữa 2 giai đoạn là toàn bộ mục 4
(topic), mục 6 (port/adapter `RealtimeGamePublisher`, nơi gọi trong use case) — vì `mqtt` npm
client publish vào `mqtt://localhost:1883` (Aedes) hay `mqtt://emqx:1883` (EMQX) đều cùng 1 dòng
code, chỉ khác `MQTT_URL`. Phần **đổi** là hạ tầng chạy broker + cách viết hàm kiểm tra quyền
subscribe (mục 5, mục 8) — cô lập đúng 1 chỗ để sau này thay không phải sửa lại use case.

Backend đóng vai **publisher duy nhất** (dùng `mqtt` npm package như một MQTT client thường,
không phải MQTT làm transport chính của NestJS microservice) — không nhận message nào từ broker,
chỉ publish. Broker chịu trách nhiệm xác thực + phân quyền subscribe, và fan-out tới mọi client
đang mở ván đó — NestJS không cần tự quản danh sách socket đang mở như cách làm WebSocket
(`socket.io`) thuần.

---

## 3. Vì sao 2 giai đoạn, và vì sao Aedes trước / EMQX sau

`@nestjs/microservices` có transport MQTT sẵn, nhưng nó thiết kế cho mô hình **request/reply
hoặc event giữa các service backend với nhau**, không phải để hàng nghìn client di động/browser
connect trực tiếp vào — muốn client connect thẳng vẫn cần một broker thật đứng giữa (Aedes,
Mosquitto, EMQX, HiveMQ...) mà `@nestjs/microservices` chỉ là 1 client nói chuyện với broker đó,
y hệt cách `mqtt` npm package làm. Do đó vẫn cần chọn broker trước; dùng thẳng `mqtt` package cho
publisher side đơn giản hơn, không cần thêm tầng `ClientProxy`/`@MessagePattern` vốn dành cho
luồng nhận-rồi-xử lý mà ở đây backend không cần (backend chỉ publish).

### 3.1. Giai đoạn 1 — Aedes (`npm i aedes`)

Mục tiêu giai đoạn này: **hoàn thiện logic BE** (topic design, port/adapter, chỗ gọi publish
trong từng use case, refactor `toGameStateOutput`) mà **chưa cần dựng hạ tầng broker riêng** —
không thêm container, không cấu hình JWT plugin/HTTP webhook của EMQX, không sửa
`docker-compose.yml` ngay. Aedes là 1 thư viện JS thuần (không phải service ngoài) implement
đúng giao thức MQTT, chạy được **ngay trong process `node`** hiện có — chỉ cần tự mở 1
`net.Server` (cổng TCP, cho mobile) + 1 WebSocket server (cho browser) rồi trỏ cả 2 vào cùng 1
instance `Aedes`. Không cần Docker, không cần image ngoài, `pnpm run start:dev` là chạy được
broker luôn — đúng mục tiêu "làm nhanh, sửa nhanh" lúc đang hoàn thiện logic.

Đánh đổi đã chấp nhận (chi tiết mục 11): Aedes **không có cluster/shared persistence** — mọi
subscription và retained message chỉ sống trong bộ nhớ của **1 process** đang chạy. Đúng cho dev
(luôn chỉ có 1 instance `start:dev`), sai nếu đem thẳng lên production chạy nhiều instance (PM2
cluster mode, nhiều container...) vì client dính vào instance A sẽ không nhận được message do
instance B publish.

### 3.2. Giai đoạn 2 — chuyển sang EMQX self-host

Khi logic BE đã ổn định (đã test thủ công đủ 3 use case publish, xem mục 10), thay Aedes bằng
EMQX self-host, lý do so với Mosquitto:
- **Authentication JWT** built-in (đối chiếu chữ ký bằng secret, không cần verify thủ công).
- **Authorization HTTP** built-in (gọi webhook ngoài để quyết định allow/deny SUBSCRIBE) — chỗ
  này bắt buộc phải "động" (kiểm tra thành viên phòng thay đổi theo thời gian) nên ACL tĩnh
  (file/database plugin đơn giản của Mosquitto) không đủ.
- Có cluster/persistence thật — giải quyết đúng giới hạn của Aedes ở trên khi cần chạy nhiều
  instance NestJS.

Việc chuyển đổi chỉ động vào **hạ tầng + auth hook** (mục 5, mục 8) — `RealtimeGamePublisher`
adapter (mục 6) không đổi 1 dòng nào, vì cả 2 đều là "publish qua `mqtt` client tới `MQTT_URL`".

---

## 4. Thiết kế topic

| Topic | Retained | Payload | Publish khi nào |
|---|---|---|---|
| `ww/room/{roomId}/state` | ✅ có | y hệt `GameStateOutput['game']` (đã có ở `get-game-state.use-case.ts`) | Ván bắt đầu (`startGame`), mỗi lần pha đổi (`advanceGame` → `continued`), ván kết thúc (`advanceGame` → `finished`) |
| `ww/room/{roomId}/lynch-votes` | ✅ có | `{ gameId, dayNumber, tally: [...] }` — y hệt response `GET /games/:gameId/lynch/votes` | Sau mỗi `castLynchVote` thành công |
| `ww/room/{roomId}/wolf-votes-ping` | ❌ không | `{ gameId, dayNumber }` — **không chứa tally, không tiết lộ ai là Sói** | Sau mỗi `castWolfVote` thành công |

Vì sao **không** có topic riêng cho `wolf-votes` tally, `getMyState`, seer checks, witch actions —
xem mục 7 (Phạm vi không làm ở v1) — đây là ranh giới quan trọng nhất của bản thiết kế này, đọc kỹ
trước khi mở rộng thêm topic.

`retained = true` cho 2 topic đầu để client vừa subscribe (mới vào ván, hoặc vừa reconnect sau
mất mạng) nhận được state hiện tại **ngay lập tức** mà không phải chờ sự kiện tiếp theo — broker
tự trả lại message cuối cùng đã publish trên topic đó. `wolf-votes-ping` không cần retained vì nó
chỉ là tín hiệu "có gì đó vừa đổi, tự gọi REST mà lấy", không mang state.

### 4.1. Vai/phe nào subscribe topic nào

Ván hiện có 2 phe (`Faction.VILLAGER`, `Faction.WEREWOLF` — `role.vo.ts`) và 5 vai: `werewolf`
(phe Sói), `villager`, `guardian`, `seer`, `witch` (4 vai còn lại đều phe Dân). Client biết mình
thuộc vai/phe nào qua `GET /games/:gameId/me` (`getMyState`, riêng tư, gọi 1 lần lúc vào ván) —
**quyết định subscribe topic nào là do CLIENT tự quyết dựa trên vai đã biết, không phải do broker
chặn theo vai** (giải thích lý do ở dưới bảng).

| Vai / phe                      | `ww/room/{roomId}/state` | `ww/room/{roomId}/lynch-votes` | `ww/room/{roomId}/wolf-votes-ping`                                             |
|--------------------------------|--------------------------|--------------------------------|--------------------------------------------------------------------------------|
| `villager` (Dân thường)        | ✅ subscribe              | ✅ subscribe                    | ❌ không cần                                                                    |
| `guardian` (Bảo vệ)            | ✅ subscribe              | ✅ subscribe                    | ❌ không cần                                                                    |
| `seer` (Tiên tri)              | ✅ subscribe              | ✅ subscribe                    | ❌ không cần                                                                    |
| `witch` (Phù thuỷ)             | ✅ subscribe              | ✅ subscribe                    | ❌ không cần                                                                    |
| `werewolf` (Sói, phe Werewolf) | ✅ subscribe              | ✅ subscribe                    | ✅ subscribe — để biết lúc nào tự `GET /games/:gameId/wolf/votes` lấy tally mới |

Tóm lại theo **phe**: cả 2 phe subscribe giống hệt nhau 2 topic đầu (`state`, `lynch-votes`) — đây
là thông tin công khai cho mọi người trong phòng, không phân biệt phe. Riêng `wolf-votes-ping`
chỉ **có ích** cho phe Sói (`werewolf`); 4 vai còn lại về lý thuyết có thể subscribe nếu muốn
nhưng vô nghĩa vì `GET /games/:gameId/wolf/votes` vẫn chặn họ ở tầng REST như cũ (domain rule
`wolfOnly: true` không đổi gì).

**Vì sao ACL không cần phân biệt theo vai/phe** (khác với phân quyền theo *phòng* ở mục 5, vốn
bắt buộc phải kiểm): `wolf-votes-ping` không mang dữ liệu (không có tally, không có ai vote ai) —
người ngoài phe Sói có subscribe được cũng chỉ biết "có một Sói vừa đổi phiếu vào lúc này", điều
này không tiết lộ gì hơn thứ `ww/room/{roomId}/state` đã công khai sẵn (đang là pha `NIGHT`). Nếu
sau này đổi ý muốn ACL chặn cả `wolf-votes-ping` theo đúng phe (defense-in-depth), sẽ cần thêm 1
lượt kiểm tra "userId này role có phải werewolf trong ván đang chạy của phòng không" ở webhook
mục 5 — phức tạp hơn (phải biết cả state ván, không chỉ thành viên phòng) nên **cố ý để ngoài
phạm vi v1**, ghi nhận ở đây để không quên nếu có yêu cầu siết chặt hơn sau này.

---

## 5. Auth & ACL

Cả 2 giai đoạn xác thực/phân quyền **cùng 1 luật nghiệp vụ** ("JWT hợp lệ" + "userId có phải
thành viên phòng roomId không") — khác nhau ở **chỗ luật đó được gọi từ đâu**. Vì vậy nên viết
luật đó thành 1 hàm/provider thuần dùng chung được cho cả 2 cách gọi, ví dụ
`isRoomMember(userId, roomId): Promise<boolean>` (đặt cạnh `GameStatusReader`/`UserDirectory` —
port hẹp do bên dùng tự định nghĩa, cùng pattern đã áp dụng cho Rooms↔Game, Auth↔Users ở
`CLEAN-ARCHITECTURE.md` mục 7) — để giai đoạn 2 chỉ cần bọc hàm này trong 1 HTTP controller, không
viết lại logic.

### 5.1. Giai đoạn 1 — Aedes (hook JS gọi thẳng, không qua HTTP)

Vì broker chạy trong cùng process, không cần vòng HTTP ra ngoài — 2 hook của Aedes là hàm JS bình
thường, gọi thẳng `JwtService`/provider NestJS đã inject sẵn:

```ts
aedes.authenticate = (client, username, password, callback) => {
  try {
    const payload = jwtService.verify(password?.toString() ?? '', {
      secret: config.getOrThrow('JWT_ACCESS_SECRET'),
    });
    (client as any).userId = payload.sub; // gắn userId vào client để dùng ở authorizeSubscribe
    callback(null, true);
  } catch {
    callback(null, false); // sai/hết hạn access token → từ chối CONNECT
  }
};

aedes.authorizeSubscribe = async (client, sub, callback) => {
  const roomId = parseRoomIdFromTopic(sub.topic); // helper dùng chung, xem dưới
  const userId = (client as any).userId;
  const allowed = roomId === null || (await isRoomMember(userId, roomId));
  callback(null, allowed ? sub : null); // trả null = từ chối subscribe topic này
};
```

Không cần `MQTT_AUTHZ_SECRET`, không cần endpoint `/internal/mqtt/authorize` ở giai đoạn này —
tự bản thân việc hook chạy trong process đã đóng vai "chỉ NestJS mới gọi được", không có kênh
mạng nào lộ ra ngoài để giả mạo.

**Lưu ý dễ bỏ sót**: `MqttRealtimeGamePublisherAdapter` (mục 6) tự nó cũng là 1 client phải đi
qua đúng hook `authenticate` này — nó không phải end-user nên không có access token thật. Cần 1
nhánh riêng trong `authenticate`: nếu `username === 'internal-publisher'` và `password` khớp
`MQTT_INTERNAL_PASSWORD` (biến môi trường mới, không phải JWT) thì cho qua ngay; ngược lại mới
verify như JWT của end-user. Adapter connect bằng `{ username: 'internal-publisher', password:
process.env.MQTT_INTERNAL_PASSWORD }`. Ở giai đoạn 2 (EMQX), vai trò này đổi thành
`MQTT_USERNAME`/`MQTT_PASSWORD` cấu hình sẵn trong EMQX (mục 5.2/8.2) — cùng 1 ý tưởng, chỉ khác
chỗ cấu hình.

### 5.2. Giai đoạn 2 — EMQX (qua HTTP webhook)

`username = "jwt"`, `password = <access token hiện có>` (không sinh thêm loại token mới). EMQX
cấu hình `authentication` type `jwt`, verify chữ ký bằng secret, lấy `sub` (userId) làm
`clientid`/`username` cho bước sau. Token hết hạn (15 phút mặc định) → client phải tự reconnect
với access token mới, giống hệt việc access token hết hạn thì REST call cũng phải refresh trước.

EMQX gọi `authorization` type `http` — mỗi lần client SUBSCRIBE vào `ww/room/{roomId}/...`, EMQX
POST tới một endpoint nội bộ mới (bọc quanh đúng `isRoomMember` ở trên):

```
POST /internal/mqtt/authorize
Headers: X-Internal-Secret: <bí mật riêng, KHÔNG phải JWT — chỉ EMQX biết>
Body: { "userId": 123, "topic": "ww/room/42/state" }
→ 200 nếu userId là thành viên phòng 42 (RoomMember), 403 nếu không
```

Endpoint này **không** đi qua `JwtAuthGuard` toàn cục (broker gọi server-to-server, không có
access token của user trong request đó) — cần `@Public()` + tự kiểm `X-Internal-Secret` so với
biến môi trường mới (`MQTT_AUTHZ_SECRET`), và chỉ đọc `RoomMember` (không sửa gì) nên rủi ro thấp
nếu secret bị lộ trong mạng nội bộ giữa 2 container — vẫn nên đặt EMQX + NestJS trong cùng
docker network riêng, không expose endpoint này ra ngoài qua reverse proxy công khai.

Việc parse `roomId` từ topic string (`ww/room/42/state` → `42`) nên đặt trong 1 hàm nhỏ dùng
chung ở cả 3 topic pattern (`parseRoomIdFromTopic`) — **dùng lại y hệt ở cả Aedes lẫn EMQX**, xem
mục 5.1 — tránh phải cấu hình regex phức tạp phía broker, để NestJS tự parse, broker chỉ forward
topic thô.

---

## 6. Chỗ nối vào Clean Architecture hiện có (GameModule)

Theo đúng pattern đã dùng cho `GameEventPublisher`/`GamePhaseScheduler` (`CLEAN-ARCHITECTURE.md`
mục 3): thêm 1 **port** mới ở Application layer, 1 **adapter** hiện thực bằng MQTT ở Infrastructure
layer, KHÔNG để Domain/Application biết `mqtt` package tồn tại.

```
src/game/application/ports/realtime-game-publisher.ts     ← PORT (interface + token)
src/game/infrastructure/mqtt-realtime-game-publisher.adapter.ts  ← Gateway, dùng `mqtt` npm client
```

```ts
// application/ports/realtime-game-publisher.ts
export interface RealtimeGamePublisher {
  publishState(roomId: number, state: GameStateOutput['game']): void;
  publishLynchVotes(roomId: number, payload: LynchVoteTallyPayload): void;
  pingWolfVotes(roomId: number, gameId: number, dayNumber: number): void;
}
export const REALTIME_GAME_PUBLISHER = Symbol('REALTIME_GAME_PUBLISHER');
```

**Việc nhỏ cần dọn trước**: `getGameState` (`get-game-state.use-case.ts`) hiện vừa kiểm tra
"người gọi có phải thành viên ván không" (`PlayerNotInGameError`) vừa build payload. Tách phần
build payload ra 1 hàm thuần `toGameStateOutput(game, roster): GameStateOutput['game']`, để:
- `getGameState` (REST, có 1 user gọi) gọi hàm này **sau khi** đã kiểm tra membership.
- `advanceGame`/`startGame` (broadcast, không gắn với 1 user cụ thể — quyền xem đã được broker
  (Aedes ở giai đoạn 1, EMQX ở giai đoạn 2) kiểm ở bước SUBSCRIBE rồi, không cần kiểm 2 lần) gọi
  thẳng hàm này, không qua `getGameState`.

**Nơi gọi publisher** (thêm `realtime` làm tham số cuối, giống cách `scheduler`/`eventPublisher`
đã được truyền vào use case hiện tại):

| Use case | Gọi gì sau khi transaction/thao tác thành công |
|---|---|
| `start-game.use-case.ts` | `realtime.publishState(roomId, toGameStateOutput(...))` |
| `advance-game.use-case.ts` — nhánh `continued` VÀ `finished` | `realtime.publishState(...)` (nhánh `finished` roster đã lộ hết vai vì `isFinished`) |
| `cast-lynch-vote.use-case.ts` | `realtime.publishLynchVotes(roomId, tally)` sau `votes.save(...)` |
| `cast-wolf-vote.use-case.ts` | `realtime.pingWolfVotes(roomId, gameId, dayNumber)` sau `votes.save(...)` |

`GameService` (Facade) inject thêm `REALTIME_GAME_PUBLISHER` làm adapter thứ 9, `game.module.ts`
thêm 1 dòng `{ provide: REALTIME_GAME_PUBLISHER, useClass: MqttRealtimeGamePublisherAdapter }` —
đúng pattern 1-dòng-mỗi-provider đã có, không phá cấu trúc hiện tại.

Adapter tự quản kết nối MQTT (connect 1 lần lúc `OnModuleInit`, publish bằng `client.publish(topic,
JSON.stringify(payload), { qos: 1, retain: true/false })`), đọc `MQTT_URL`/`MQTT_USERNAME`/
`MQTT_PASSWORD` qua `ConfigService` giống cách `DATABASE_URL` đang được đọc — connection riêng
của backend tới broker dùng username/password thường (không phải JWT), vì đây là kết nối
server-to-server tin cậy, không cần qua cùng cơ chế auth của client.

**Bản thân broker (Aedes) chạy ở đâu**: KHÔNG đặt trong `GameModule` — broker không thuộc riêng
game, nó là hạ tầng chung (nếu sau này có tính năng realtime khác ngoài game cũng dùng chung
broker này). Tạo module mới `src/realtime/realtime.module.ts`, `global: true` hoặc import 1 lần ở
`AppModule`, chịu trách nhiệm: khởi tạo `Aedes`, mở `net.Server` (TCP) + WebSocket server, gắn 2
hook `authenticate`/`authorizeSubscribe` (mục 5.1). `GameModule`'s `MqttRealtimeGamePublisherAdapter`
không cần biết `RealtimeModule` tồn tại — nó chỉ là 1 `mqtt` client bình thường connect tới
`MQTT_URL` (`mqtt://localhost:1883` lúc dev), y hệt cách nó sẽ connect tới EMQX ở giai đoạn 2.

---

## 7. Phạm vi KHÔNG làm ở v1 — và vì sao

- **Không** publish tally Sói (`wolf-votes`) qua MQTT, chỉ ping "có gì đổi". Tally Sói chỉ được
  xem bởi Sói còn sống (luật đã có ở `getVoteTally(..., { wolfOnly: true })`) — muốn đẩy thẳng
  tally qua MQTT thì cần 1 topic riêng mà EMQX chỉ cho đúng nhóm Sói của ván đó subscribe, tức
  ACL phải biết "userId này có đang là Sói trong ván X không" — thông tin đổi theo từng ván, bí
  mật, và đúng thứ REST đang bảo vệ kỹ (domain rule, không lộ qua response cho người ngoài). Làm
  đúng việc này qua MQTT ACL phức tạp hơn nhiều so với lợi ích (chỉ tiết kiệm 1 lần gọi REST GET
  vốn đã nhanh) — v1 chấp nhận Sói nhận ping realtime rồi tự `GET
  /games/:gameId/wolf/votes` (đường cũ, guard cũ, không đổi gì) để lấy tally thật.
- **Không** đẩy `getMyState` (vai trò, đồng đội Sói, soi được kỹ năng gì) qua MQTT — thông tin
  riêng tư nhất trong toàn bộ ván. Client tự gọi REST 1 lần khi vào ván và khi mở ra "trạng thái
  của tôi", tần suất đổi rất thấp so với state chung (chỉ đổi khi mình chết hoặc dùng skill xong
  — cả 2 đều do chính client vừa POST xong, đã có kết quả trong response rồi, không cần push
  thêm).
- **Không** cho client publish action qua MQTT (đã chốt ở mục 0) — action vẫn 100% REST.
- **Không** dùng MQTT cho đếm ngược timer (publish mỗi giây) — lãng phí băng thông/broker load;
  `phaseEndsAt` (timestamp tuyệt đối) đã có sẵn trong `ww/room/{roomId}/state`, client tự tính
  đếm ngược cục bộ bằng `phaseEndsAt - Date.now()`.

Nếu sau này thật sự cần đẩy dữ liệu riêng tư theo thời gian thực (vd. hiện popup "bạn bị cắn"
ngay khoảnh khắc chết thay vì đợi state chung), hướng mở rộng là topic theo **user**, không theo
room: `ww/user/{userId}/...`, ACL JWT tĩnh đơn giản (`sub` trong token khớp `{userId}` trong topic
— không cần webhook vì không phụ thuộc trạng thái phòng), payload cũng chỉ nên là "ping, tự gọi
REST" chứ không nhét thẳng dữ liệu nhạy cảm lên broker.

---

## 8. Hạ tầng

### 8.1. Giai đoạn 1 — Aedes, không cần sửa `docker-compose.yml`

```bash
pnpm add aedes ws
```

(`ws` để tự mở WebSocket listener cho browser — Aedes core chỉ lo phần giao thức MQTT, việc nghe
TCP/WS là trách nhiệm của người dùng thư viện, không có sẵn "kèm hộp" như EMQX.)

`src/realtime/realtime.module.ts` (phác thảo, viết chi tiết lúc implement):

```ts
import * as net from 'net';
import { Server as WsServer } from 'ws';
import Aedes from 'aedes';

const aedes = new Aedes();
net.createServer(aedes.handle).listen(mqttTcpPort);     // mobile/native
const wsServer = new WsServer({ port: mqttWsPort });
wsServer.on('connection', (conn) => aedes.handle(conn)); // browser
```

**Biến môi trường mới cần thêm** (bổ sung bảng ở `CLAUDE.md`):

| Variable | Mô tả | Giá trị dev gợi ý |
|---|---|---|
| `MQTT_URL` | URL adapter dùng để publish | `mqtt://localhost:1883` |
| `MQTT_TCP_PORT` | Cổng Aedes nghe TCP (mobile/native) | `1883` |
| `MQTT_WS_PORT` | Cổng Aedes nghe WebSocket (browser) | `8083` |
| `MQTT_INTERNAL_PASSWORD` | Mật khẩu riêng để `RealtimeGamePublisher` adapter tự xác thực với Aedes (mục 5.1), không phải JWT | tự sinh, để trong `.env`, không commit |

Không cần container mới, không cần đổi `docker-compose.yml` ở giai đoạn này.

### 8.2. Giai đoạn 2 — thay bằng EMQX self-host

```yaml
  emqx:
    image: emqx/emqx:5
    container_name: werewolf-emqx
    ports:
      - '1883:1883'   # MQTT TCP — mobile/native
      - '8083:8083'   # MQTT over WebSocket — browser (ws://)
      - '8084:8084'   # MQTT over WebSocket TLS (wss://) — bắt buộc khi lên production/HTTPS
      - '18083:18083' # Dashboard quản trị EMQX
    volumes:
      - emqx_data:/opt/emqx/data
```

Cấu hình `authentication` (JWT) + `authorization` (HTTP → `http://host.docker.internal:3000/internal/mqtt/authorize`
lúc dev, đổi thành tên service thật trong docker network lúc production) khai báo qua EMQX
dashboard hoặc file `emqx.conf` mount vào container — quyết định cụ thể (dashboard tay vs
config-as-code) để lúc triển khai, không chặn thiết kế này.

Biến môi trường đổi so với 8.1: `MQTT_URL` trỏ sang `mqtt://emqx:1883`, `MQTT_INTERNAL_PASSWORD`
đổi tên ý nghĩa thành `MQTT_USERNAME`/`MQTT_PASSWORD` (credential cấu hình trong EMQX), thêm mới
`MQTT_AUTHZ_SECRET` (secret dùng để EMQX gọi ngược `/internal/mqtt/authorize`, so sánh header
`X-Internal-Secret`, xem mục 5.2). Bỏ `MQTT_TCP_PORT`/`MQTT_WS_PORT` (EMQX tự nghe cổng cố định
trong container, không phải NestJS tự mở).

---

## 9. Client-side flow (tham khảo, không phải phần backend)

```
1. Login REST như cũ → có access token.
2. Vào ván: GET /games/room/:roomId → state chắc chắn đúng tại thời điểm gọi.
3. Connect MQTT: mqtt.connect(MQTT_WS_URL, { username: 'jwt', password: accessToken }).
4. Subscribe ww/room/{roomId}/state, ww/room/{roomId}/lynch-votes,
   (nếu biết mình là Sói qua bước 2/getMyState) ww/room/{roomId}/wolf-votes-ping.
5. Nhận message → merge vào state cục bộ, KHÔNG tự suy luận gì thêm ngoài dữ liệu nhận được.
6. Mất kết nối MQTT (rớt mạng...) → khi reconnect, EMQX tự trả lại retained message mới nhất
   trên state/lynch-votes NGAY khi subscribe lại — nhưng để chắc chắn tuyệt đối (đề phòng retained
   message bị mất do broker restart), client NÊN gọi lại REST GET 1 lần mỗi khi MQTT reconnect
   sau khi đã mất kết nối > vài giây, rồi mới tiếp tục tin MQTT.
```

---

## 10. Việc cần làm (checklist triển khai, theo thứ tự)

### Giai đoạn 1 — Aedes

1. Cài `pnpm add aedes ws mqtt`.
2. Viết `isRoomMember(userId, roomId)` — port hẹp riêng theo đúng nguyên tắc "port hẹp do bên
   dùng tự định nghĩa" đã áp dụng cho `GameStatusReader`/`UserDirectory` (`CLEAN-ARCHITECTURE.md`
   mục 7), tránh `RoomsModule` phải export thẳng repository đầy đủ.
3. Tạo `src/realtime/realtime.module.ts`: khởi tạo `Aedes`, mở TCP + WS listener, gắn hook
   `authenticate` (JWT + nhánh `internal-publisher`, mục 5.1) và `authorizeSubscribe` (gọi
   `isRoomMember`).
4. Thêm biến môi trường mới vào `.env`/`CLAUDE.md` (bảng mục 8.1).
5. Tách `toGameStateOutput` khỏi `get-game-state.use-case.ts` (mục 6).
6. Thêm port `RealtimeGamePublisher` + token, thêm adapter MQTT ở Infrastructure
   (`mqtt.connect(MQTT_URL, { username: 'internal-publisher', password: MQTT_INTERNAL_PASSWORD })`).
7. Gọi publisher từ 3 use case: `start-game`, `advance-game`, `cast-lynch-vote`,
   `cast-wolf-vote` (mục 6, bảng "Nơi gọi publisher").
8. Đăng ký provider thứ 9 trong `game.module.ts`, thêm tham số vào `GameService` facade.
9. Test thủ công: dùng `mqtt.js` CLI (`mqtt sub -t 'ww/room/+/state' -h localhost`) song song
   với việc gọi REST để tạo phòng/bắt đầu ván/vote, xác nhận payload nhận qua MQTT khớp với
   REST tại từng bước — quy trình kiểm chứng giống cách `CLEAN-ARCHITECTURE.md` mục 6 đã làm cho
   từng bước tách layer trước đó (boot thật, gọi API thật, không chỉ đọc code). Test cả trường
   hợp bị từ chối: CONNECT với token sai/hết hạn, SUBSCRIBE vào phòng mình không phải thành viên.

Chưa có bước "viết automated test" cho luồng MQTT — giống tình trạng chung của dự án (mục 5.1
`CLEAN-ARCHITECTURE.md`: chưa có unit test cho Domain/Application layer nào) — ghi nhận là nợ kỹ
thuật, không phải việc phải làm trong lượt đầu triển khai realtime này.

### Giai đoạn 2 — chuyển sang EMQX (làm sau, khi giai đoạn 1 đã chạy ổn)

10. Thêm service `emqx` vào `docker-compose.yml` (mục 8.2), cấu hình `authentication` JWT +
    `authorization` HTTP trỏ về endpoint mới.
11. Viết endpoint `POST /internal/mqtt/authorize` (`@Public()`, tự kiểm `X-Internal-Secret`,
    gọi lại đúng `isRoomMember` đã viết ở bước 2 — không viết lại logic).
12. Đổi biến môi trường theo bảng chênh lệch ở mục 8.2, xoá `realtime.module.ts` (không còn cần
    tự mở TCP/WS server — EMQX làm việc đó), `RealtimeGamePublisher` adapter chỉ đổi
    `MQTT_URL`/credential, không đổi logic publish.
13. Lặp lại bước test thủ công (bước 9) trên EMQX để xác nhận hành vi giống hệt Aedes trước khi
    tắt hẳn Aedes.

---

## 11. Rủi ro / đánh đổi cần biết trước khi triển khai

### Riêng giai đoạn 1 (Aedes) — đọc kỹ trước khi bắt đầu code

- **`start:dev` chạy watch mode → mỗi lần sửa file, process restart → Aedes trong process đó
  cũng restart theo** — mọi retained message và mọi subscription đang có đều mất sạch (Aedes mặc
  định lưu mọi thứ trong RAM, không có persistence backend). Khác REST (stateless, restart không
  ảnh hưởng gì) và khác EMQX thật (service riêng, NestJS restart không đụng tới broker) — đây là
  đánh đổi **chấp nhận được vì đang ở giai đoạn code/test thủ công** (mục 10 bước 9 vốn đã tính
  đến việc phải tự gọi REST lại sau mỗi lần thử), **không chấp nhận được nếu đem thẳng lên môi
  trường nhiều người dùng thật** — đây chính là lý do phải chuyển sang EMQX ở giai đoạn 2 trước
  khi ra production, không phải tối ưu sớm.
- **Không có cluster** — nếu tại bất kỳ thời điểm nào chạy nhiều hơn 1 instance NestJS (PM2
  cluster mode, nhiều container cùng lúc để chịu tải), client subscribe vào instance A sẽ không
  nhận được state do instance B publish (mỗi instance có Aedes riêng, không đồng bộ với nhau) —
  không phải bug, là giới hạn thiết kế đã biết trước của việc chọn Aedes, xử lý bằng cách chuyển
  sang EMQX (mục 3.2) trước khi cần chạy nhiều instance, không phải cố vá Aedes.
- Hook `authenticate` chạy đúng trong request-response cycle của kết nối MQTT — nếu viết sai
  thành hàm bất đồng bộ không gọi `callback` đúng lúc (quên `await`, quên `try/catch` quanh
  `jwtService.verify`) thì client treo vô thời hạn ở bước CONNECT thay vì bị từ chối rõ ràng —
  cần test path lỗi (token sai) kỹ như path đúng (mục 10 bước 9).

### Chung cho cả 2 giai đoạn

- **Broker down = mất realtime, nhưng REST vẫn chạy bình thường** vì MQTT không phải nguồn sự
  thật — đây là lý do thiết kế "REST vẫn luôn đúng, MQTT chỉ tăng tốc" ở mục 1 quan trọng, đúng
  cho cả Aedes lẫn EMQX.
- **Access token 15 phút hết hạn** buộc client phải tự reconnect MQTT định kỳ (không tự động như
  REST refresh) — cần xử lý ở tầng client (mục 9 bước 3), không phải việc của backend nhưng cần
  lưu ý khi viết SDK/hướng dẫn cho client.

### Riêng giai đoạn 2 (EMQX) — áp dụng khi chuyển sang

- **EMQX là service mới phải tự vận hành** — thêm 1 điểm lỗi vận hành hạ tầng mà giai đoạn 1
  (Aedes, không service riêng) không có.
- **`/internal/mqtt/authorize` là bề mặt tấn công mới** nếu lỡ expose ra internet công khai — bắt
  buộc chỉ nghe trong docker network nội bộ hoặc chặn ở firewall/reverse proxy, không map port
  NestJS đó ra ngoài giống các route REST khác.
