# Thiết kế khởi tạo Ván chơi (GameModule — phần start/finish)

Tài liệu này chỉ thiết kế phần **khởi tạo và kết thúc một ván chơi** (chia vai, tạo state ban đầu, đóng ván) và cách `GameModule` phối hợp với `RoomsModule`. **Chưa** thiết kế phần xử lý luật chơi (thứ tự hành động đêm, bỏ phiếu ngày, tính điều kiện thắng...) — phần đó tham chiếu luật ở [game-rules.md](./game-rules.md) và sẽ có tài liệu kỹ thuật riêng khi thực thi.

---

## 1. Mô hình dữ liệu

### 1.1. Bảng `games`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | serial PK | |
| `roomId` | FK → `rooms.id` | Không unique — 1 phòng có thể chơi nhiều ván (mỗi lần `finishGame()` phòng quay về `WAITING` rồi start lại) |
| `status` | enum: `IN_PROGRESS`, `FINISHED`, `CANCELLED` | |
| `phase` | enum: `NIGHT`, `DAY` | Mặc định `NIGHT` lúc tạo (đêm 0) |
| `dayNumber` | smallint, default 0 | Tăng dần mỗi khi chuyển `DAY` → `NIGHT` |
| `winner` | enum nullable: `VILLAGER`, `WEREWOLF`, `THIRD_PARTY` | `null` khi ván chưa kết thúc |
| `startedAt` | timestamp | |
| `finishedAt` | timestamp nullable | |

### 1.2. Bảng `game_players`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | serial PK | |
| `gameId` | FK → `games.id`, `ON DELETE CASCADE` | |
| `userId` | FK → `users.id` | |
| `role` | varchar | Khớp key trong `ROLE_CONFIG_BY_MAX_PLAYERS` (`werewolf`, `villager`, `seer`, `guard`, `witch`, `hunter`, `fool`) |
| `isAlive` | boolean, default true | |

Ràng buộc: `UNIQUE(gameId, userId)`.

> `game_players` snapshot vai trò tại thời điểm tạo ván — không đổi trong suốt ván (trừ khi luật có kỹ năng "biến hình" thuộc phần mở rộng, ngoài phạm vi tài liệu này).

---

## 2. Quan hệ module: event-driven, không import lẫn nhau

`RoomsModule` và `GameModule` **không** đưa nhau vào `imports: []` và **không** inject thẳng service của nhau. Lý do: `RoomsModule` cần báo `GameModule` lúc start ván, `GameModule` cần báo ngược `RoomsModule` lúc kết thúc ván — nếu import trực tiếp 2 chiều sẽ tạo circular dependency giữa 2 module (Nest không tuần tự khởi tạo được), phải vá bằng `forwardRef()` ở 4 chỗ (2 module + 2 constructor) và khoá chặt 2 module vào nhau vĩnh viễn.

Thay vào đó dùng `@nestjs/event-emitter` (`EventEmitterModule.forRoot()` đăng ký global 1 lần ở `AppModule`):

- Mỗi module chỉ phụ thuộc gói `@nestjs/event-emitter` trung lập, không phụ thuộc lẫn nhau.
- Bên bắn: inject `EventEmitter2`, gọi `.emit('event.name', payload)`.
- Bên nghe: method có decorator `@OnEvent('event.name')` trong 1 provider bất kỳ của module đó (không cần biết ai bắn).

### Bảng event

| Event | Bắn bởi | Lắng nghe bởi | Payload |
|---|---|---|---|
| `room.started` | `RoomsService.startGame()` | `GameModule` | `{ roomId, maxPlayers, memberIds }` |
| `game.start_failed` | `GameModule` (khi tạo `Game`/`GamePlayer` lỗi) | `RoomsModule` | `{ roomId, reason }` |
| `room.deleted` | `RoomsService.removeRoom()` | `GameModule` | `{ roomId }` |
| `game.finished` | `GameModule` (rule engine tương lai, khi thoả điều kiện thắng — xem [game-rules.md §5](./game-rules.md)) | `RoomsModule` | `{ roomId }` |

---

## 3. Luồng bắt đầu ván

1. Client gọi `POST /rooms/:id/start` như hiện có ([room.md §4.5](./room.md)).
2. `RoomsService.startGame()` giữ nguyên các kiểm tra hiện tại (host, `status === WAITING`, đủ `maxPlayers` người), set `room.status = PLAYING`, lưu DB.
3. Sau khi lưu thành công, emit `room.started` với `{ roomId, maxPlayers, memberIds }` (`memberIds` lấy từ `room_members` hiện tại của phòng).
4. `GameModule` lắng nghe `room.started`:
   - Kiểm tra idempotent: nếu đã tồn tại `Game` với `roomId` này ở `status = IN_PROGRESS` thì bỏ qua (log warning), tránh tạo trùng nếu event bắn lặp.
   - Chia vai theo mục 4 bên dưới.
   - Tạo record `Game` (`status = IN_PROGRESS`, `phase = NIGHT`, `dayNumber = 0`, `startedAt = now()`).
   - Tạo các record `GamePlayer` tương ứng.
   - Nếu bước tạo `Game`/`GamePlayer` lỗi (DB exception) → emit `game.start_failed { roomId, reason }` để `RoomsModule` revert `room.status` về `WAITING` (tránh phòng bị kẹt ở `PLAYING` mà không có ván nào thực sự chạy).

---

## 4. Chia vai trò (thuật toán)

1. Lấy `roleConfig = ROLE_CONFIG_BY_MAX_PLAYERS[maxPlayers]` (định nghĩa tại `src/rooms/constants/room-configs.ts`, xem [room.md §1.1](./room.md)).
2. Build một mảng phẳng các vai trò từ `roleConfig`, ví dụ với 6 người `{werewolf:1, villager:4, seer:1}` → `['werewolf','villager','villager','villager','villager','seer']`.
3. Shuffle mảng vai trò bằng thuật toán Fisher–Yates (đảm bảo phân phối đều, tránh bias của `Array.sort(() => Math.random() - 0.5)`).
4. Ghép theo index với `memberIds` (thứ tự `memberIds` không quan trọng vì vai trò đã được xáo trộn độc lập).
5. Insert từng `GamePlayer { gameId, userId, role, isAlive: true }`.

---

## 5. Luồng kết thúc ván

1. Khi rule engine (tương lai) xác định thoả điều kiện thắng ([game-rules.md §5](./game-rules.md)), `GameModule` set `game.status = FINISHED`, `winner`, `finishedAt = now()`.
2. Emit `game.finished { roomId }`.
3. `RoomsModule` lắng nghe `game.finished`, tự gọi nội bộ `RoomsService.finishGame(roomId)` (method có sẵn, không đổi) — set `room.status = WAITING`, member giữ nguyên.

> `POST /rooms/:id/finish` vẫn **không** phải REST endpoint public — cập nhật lại [room.md §3](./room.md): việc kết thúc ván giờ đi qua event `game.finished` chứ không phải `GameModule` gọi thẳng `RoomsService.finishGame()` như bản nháp ban đầu.

---

## 6. Luồng xoá phòng giữa ván

`RoomsService.removeRoom()` cho phép xoá phòng cả khi đang `PLAYING` ([room.md §4.7](./room.md)). Sau khi xoá `Room` (cascade `RoomMember`), emit `room.deleted { roomId }`. `GameModule` lắng nghe: nếu có `Game` đang `IN_PROGRESS` cho `roomId` đó → set `status = CANCELLED`, `finishedAt = now()`.

---

## 7. Bảo mật thông tin vai trò

Vai trò là bí mật riêng của từng người chơi (trừ phe Sói biết nhau). Endpoint lấy trạng thái ván (thiết kế chi tiết để sau, ngoài phạm vi tài liệu này) **không được** trả `role` của người khác một cách trần trụi:

- `myRole`: vai trò của chính user gọi request.
- Danh sách người chơi khác: chỉ trả `{ userId, isAlive }`, **không** kèm `role` — trừ khi:
  - Người chơi đó đã chết (`isAlive = false`) — có thể công khai vai trò lúc chết theo luật (tuỳ biến thể).
  - Ván đã `FINISHED`/`CANCELLED` — công khai toàn bộ vai trò để tổng kết.
  - User gọi request thuộc phe Sói và người được hỏi cũng là Sói (Sói biết nhau).

---

## 8. Vấn đề biên

| Tình huống | Cách xử lý |
|---|---|
| `room.started` bắn nhưng `GameModule` tạo `Game` thất bại | Emit `game.start_failed`, `RoomsModule` revert `room.status` về `WAITING` |
| `room.started` bắn trùng (do lỗi hạ tầng event bus retry) | `GameModule` check `Game IN_PROGRESS` theo `roomId` trước khi tạo mới, bỏ qua nếu đã có |
| Xoá phòng khi đang `PLAYING` | `room.deleted` → `GameModule` set `Game` liên quan thành `CANCELLED` |
| Client hỏi vai trò người khác qua API thông thường | Chặn ở tầng response mapping (mục 7), không lộ `role` trừ các trường hợp đã liệt kê |

---

## 9. Rule engine bỏ phiếu (đêm/ngày)

`POST /games/:gameId/kill/:userId` (placeholder) đã được thay bằng rule engine thật, tự chạy bằng timer trong `GameService` (không dùng queue/`@nestjs/schedule` — `setTimeout` trong bộ nhớ process, key theo `gameId`). Chưa có WebSocket nên client tự poll `GET /games/room/:roomId` để lấy `phase`/`phaseEndsAt`/kết quả mới nhất.

### 9.1. Pha và thời lượng

`Game.phase` có 3 giá trị: `NIGHT` → `DAY` (thảo luận) → `DAY_VOTE` (bỏ phiếu) → quay lại `NIGHT` (tăng `dayNumber`). `game-rules.md` §4 mô tả "Ban ngày" là 1 pha gộp thảo luận + vote; `DAY`/`DAY_VOTE` là 2 pha kỹ thuật tách ra để rule engine biết lúc nào mở cửa nhận phiếu.

| Pha | Thời lượng | Ai được vote | Kết thúc pha |
|---|---|---|---|
| `NIGHT` | 2 phút | Sói còn sống, chọn nạn nhân | Kiểm phiếu Sói → cắn chết người nhiều phiếu nhất (không công khai), rồi chuyển `DAY` |
| `DAY` | 5 phút | Không nhận phiếu (chỉ thảo luận) | Hết giờ tự chuyển `DAY_VOTE`, không kiểm phiếu gì |
| `DAY_VOTE` | 1 phút | Toàn bộ người còn sống, chọn người treo cổ | Kiểm phiếu cả làng → treo cổ người nhiều phiếu nhất, rồi kiểm tra thắng thua (mục 5), nếu chưa xong thì `dayNumber += 1` và quay lại `NIGHT` |

**Hòa phiếu (không có ai có số phiếu cao nhất duy nhất) → không giết/không treo cổ ai** — áp dụng như nhau cho cả `NIGHT` và `DAY_VOTE`.

### 9.2. Endpoint

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/games/room/:roomId` | Trạng thái ván hiện tại (kèm `phase`, `dayNumber`, `phaseEndsAt`), áp bộ lọc ẩn vai trò ở mục 7 |
| `POST` | `/games/:gameId/vote` | Body `{ targetUserId }`. `NIGHT`: chỉ Sói còn sống gọi được. `DAY_VOTE`: ai còn sống cũng gọi được. Gọi lại nhiều lần = đổi phiếu (không cộng dồn) |
| `GET` | `/games/:gameId/votes` | Kiểm phiếu hiện tại của lượt đang mở. `NIGHT` chỉ Sói xem được (bàn bạc kín, thấy phiếu đổi real-time qua polling); `DAY_VOTE` ai cũng xem được (công khai) |

Bảng `game_votes` lưu 1 dòng/người/lượt (`UNIQUE(gameId, phase, dayNumber, voterId)`) — đổi phiếu là `UPDATE`, không tạo dòng mới, nên kiểm phiếu luôn tính đúng phiếu gần nhất.

### 9.3. Điều kiện thắng đã xử lý đầy đủ

Khác với placeholder cũ, rule engine giờ xử lý luôn điều kiện thắng của "Người điên" (mục [game-rules.md §5](./game-rules.md)): nếu người bị treo cổ trong `DAY_VOTE` có vai trò thuộc `THIRD_PARTY_ROLES`, ván kết thúc ngay với `winner = THIRD_PARTY` (đơn giản hoá — không xử lý trường hợp nhiều phe cùng thắng độc lập).

### 9.4. Giới hạn hiện tại

- Timer chạy trong bộ nhớ process (`Map<gameId, Timeout>` trong `GameService`) — server restart giữa ván sẽ làm ván đó không tự chuyển pha nữa (chưa có persistence/queue cho timer).
- Chưa có WebSocket broadcast — client phải tự poll để biết pha đổi/ai bị giết. Thiết kế gateway tương lai xem [room.md §6](./room.md).

---

## 10. Ghi chú triển khai

- `EventEmitterModule.forRoot()` đăng ký 1 lần, global, ở `AppModule`.
- `RoomsModule` và `GameModule` đều không xuất hiện trong `imports: []` của nhau.
- `RoomsService`/`GameService` inject `EventEmitter2` để `.emit(...)`; listener đặt trong service tương ứng của module nghe, dùng `@OnEvent('event.name')`.
