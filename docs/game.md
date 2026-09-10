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
| `phase` | enum: `NIGHT`, `DAY` | Mặc định `NIGHT` lúc tạo. Cả 2 pha đều 60s và đều mở cổng bỏ phiếu — xem [game-rounds.md](./game-rounds.md) |
| `dayNumber` | smallint, default 0 | Số thứ tự lượt chơi, tăng mỗi khi chuyển `DAY` → `NIGHT` |
| `winner` | enum nullable: `VILLAGER`, `WEREWOLF`, `THIRD_PARTY` | `null` khi ván chưa kết thúc. `THIRD_PARTY` hiện chưa dùng — dành cho vai Người điên khi nâng cấp |
| `startedAt` | timestamp | |
| `finishedAt` | timestamp nullable | |

### 1.2. Bảng `game_players`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | serial PK | |
| `gameId` | FK → `games.id`, `ON DELETE CASCADE` | |
| `userId` | FK → `users.id` | |
| `role` | varchar | Khớp key trong `ROLE_CONFIG_BY_MAX_PLAYERS`. Hiện có `werewolf`, `villager`, `seer`, `guardian` |
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
2. Build một mảng phẳng các vai trò từ `roleConfig`, ví dụ với 6 người `{werewolf:1, villager:5}` → `['werewolf','villager','villager','villager','villager','villager']`.
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

Vai trò là bí mật. Thông tin được tách làm 2 endpoint theo nguyên tắc ở §9.2 — dưới đây là quy tắc lộ vai của từng bên.

**`GET /games/room/:roomId`** — danh sách người chơi chỉ trả `{ userId, isAlive, role }`, trong đó `role` là `null` trừ khi:

- Người chơi đó **đã chết** (`isAlive = false`) — vai công khai lúc chết, **mọi người đều thấy như nhau**.
- Ván đã `FINISHED`/`CANCELLED` — công khai toàn bộ để tổng kết.

> Điều kiện "đã chết" xét trên **người đang được liệt kê**, không phải người đang xem. Một người chết đi thì vai của *họ* lộ cho cả làng; còn *họ* thì vẫn không nhìn thấy vai của những người còn sống.

**`GET /games/:gameId/me`** — nơi duy nhất trả dữ liệu phụ thuộc người gọi:

- `role`: vai của chính người gọi.
- `teammates`: danh sách Sói khác — **chỉ dựng khi người gọi là Sói**. Đây là chỗ cài luật "Sói biết nhau", đã chuyển ra khỏi endpoint trạng thái ván.

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

`POST /games/:gameId/kill/:userId` (placeholder) đã được thay bằng rule engine thật. Lịch chuyển pha do `SchedulerRegistry` của `@nestjs/schedule` giữ — **mỗi ván một timer riêng** tên `game-phase-{id}`, không quét DB định kỳ. Chưa có WebSocket nên client tự poll `GET /games/room/:roomId` để lấy `phase`/`phaseEndsAt`/kết quả mới nhất.

Thiết kế đầy đủ của vòng lượt: [game-rounds.md](./game-rounds.md).

### 9.1. Pha và thời lượng

`Game.phase` có 2 giá trị và **cả hai đều mở cổng bỏ phiếu**: `NIGHT` → `DAY` → quay lại `NIGHT` (tăng `dayNumber`). Một lượt = 2 pha = 120 giây.

| Pha | Thời lượng | Ai được vote | Kết thúc pha |
|---|---|---|---|
| `NIGHT` | 60 giây | Sói còn sống, chọn nạn nhân | Kiểm phiếu Sói → cắn chết người nhiều phiếu nhất (không công khai) → xét thắng thua → chuyển `DAY` |
| `DAY` | 60 giây | Toàn bộ người còn sống, chọn người treo cổ | Kiểm phiếu cả làng → treo cổ người nhiều phiếu nhất → xét thắng thua (mục 5) → `dayNumber += 1` và quay lại `NIGHT` |

**Hòa phiếu (không có ai có số phiếu cao nhất duy nhất) → không giết/không treo cổ ai** — áp dụng như nhau cho cả 2 pha.

Không còn pha thảo luận riêng: cả làng bàn bạc ngay trong 60 giây của `DAY`.

### 9.2. Endpoint

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/games/room/:roomId` | Trạng thái ván — **giống hệt nhau với mọi người trong ván** |
| `GET` | `/games/:gameId/me` | Mọi thứ riêng tư của người gọi (vai, đồng đội, kỹ năng) |
| `POST` | `/games/:gameId/vote` | Body `{ targetUserId }`. `NIGHT`: chỉ Sói còn sống gọi được. `DAY`: ai còn sống cũng gọi được. Gọi lại nhiều lần = đổi phiếu (không cộng dồn) |
| `GET` | `/games/:gameId/votes` | Kiểm phiếu hiện tại của pha đang mở. `NIGHT` chỉ Sói xem được (bàn bạc kín, thấy phiếu đổi real-time qua polling); `DAY` ai cũng xem được (công khai) |
| `POST` | `/games/:gameId/seer/check` | Body `{ targetUserId }`. Tiên tri soi 1 người trong đêm hiện tại — mỗi đêm 1 lượt, ghi rồi không sửa được |
| `GET` | `/games/:gameId/seer/checks` | Lịch sử soi của chính người gọi. Chỉ Tiên tri đọc được, lọc theo danh tính từ access token |
| `POST` | `/games/:gameId/guardian/protect` | Body `{ targetUserId }`. Bảo vệ che 1 người khỏi bị Sói cắn đêm nay. Không tự che mình, không trùng 2 đêm liên tiếp |
| `GET` | `/games/:gameId/guardian/protects` | Lịch sử che của chính người gọi. Chỉ Bảo vệ đọc được |

Bảng `game_votes` lưu 1 dòng/người/lượt (`UNIQUE(gameId, phase, dayNumber, voterId)`) — đổi phiếu là `UPDATE`, không tạo dòng mới, nên kiểm phiếu luôn tính đúng phiếu gần nhất.

#### Nguyên tắc tách: trạng thái ván ≠ trạng thái của tôi

Hai endpoint đầu **không được gộp**. Ranh giới:

| | `/games/room/:roomId` | `/games/:gameId/me` |
|---|---|---|
| Nội dung | Ván đang thế nào | Tôi là ai, tôi làm được gì lúc này |
| Phụ thuộc người gọi | **Không** — 2 người cùng ván nhận phản hồi y hệt nhau | **Có** — mỗi người một kiểu |
| Chứa bí mật | Không | Có |

Lợi ích của việc giữ endpoint ván **không phụ thuộc người xem**: chỉ cần lọt một trường bí mật vào đó là lộ cho *tất cả* người chơi. Khi endpoint đó về nguyên tắc không chứa gì riêng tư thì việc rà soát rò rỉ chỉ còn gói gọn ở `/me`. Đây cũng là chỗ đặt tự nhiên cho mọi vai đặc biệt sau này (Bảo vệ đã che ai chưa, Phù thuỷ còn mấy bình thuốc) — không phải phình endpoint ván ra mỗi lần thêm vai.

#### `GET /games/room/:roomId`

```jsonc
// Phòng đã/đang chơi
{
  "game": {
    "id": 12, "roomId": 4,
    "status": "IN_PROGRESS", "phase": "NIGHT",
    "dayNumber": 2, "phaseEndsAt": "...", "winner": null,
    "players": [
      { "userId": 3, "isAlive": true,  "role": null },
      { "userId": 7, "isAlive": false, "role": "werewolf" }
    ]
  }
}

// Phòng chưa chơi ván nào — 200, KHÔNG phải 404
{ "game": null }
```

**Phòng chưa có ván không phải lỗi.** Đó là trạng thái bình thường của một phòng đang chờ, nên endpoint trả `{ "game": null }` với mã 200 để client cứ gọi thoải mái mà không phải bắt 404.

Kết quả được bọc trong khoá `game` thay vì trả thẳng object (hoặc trả `null` trần) vì Nest gửi **body rỗng** khi handler trả `null` — client không phân biệt được với lỗi mạng, và `res.json()` sẽ ném lỗi khi parse. Bọc lại cũng cho cùng một kiểu với `{ "room": ... }` của `GET /rooms/me`.

`role` chỉ hiện khi **khách quan đã công khai**: người đó đã chết, hoặc ván đã kết thúc. Không phụ thuộc việc người gọi có phải Sói hay không.

Vẫn còn đúng một lỗi thật ở endpoint này: người gọi **không thuộc ván** thì 403. Chuyện đó chỉ xảy ra khi phòng đang `WAITING`, có ván cũ đã kết thúc, và người gọi mới vào phòng sau đó — không nằm trong luồng khôi phục ở [room.md §8](./room.md), vì lúc phòng `PLAYING` thì danh sách thành viên bị khoá.

Vẫn yêu cầu người gọi là thành viên của ván (người ngoài gọi → 403).

#### `GET /games/:gameId/me`

```
{
  "userId": 3, "role": "werewolf", "isAlive": true,
  "teammates": [7, 11],
  "canVoteNow": true,
  "myVoteTargetId": 5
}
```

- `teammates` — **chỉ có với Sói**, là danh sách các Sói khác. Đây chính là phần "Sói biết nhau" được chuyển ra khỏi endpoint ván. Vai khác không có khoá này.
- `canVoteNow` — bây giờ bấm bỏ phiếu có được không (gộp: ván đang chạy, còn sống, và nếu là đêm thì phải là Sói).
- `myVoteTargetId` — phiếu hiện tại của chính mình trong pha đang mở, `null` nếu chưa bỏ.

Khi có thêm vai đặc biệt thì mỗi vai thêm đúng một khoá của riêng mình vào đây, và khoá đó **chỉ được dựng khi người gọi đúng là vai đó** — xem [role-tien-tri.md §6.4](./role-tien-tri.md).

#### Ảnh hưởng tới client

Đây là **thay đổi phá vỡ tương thích** với endpoint đang chạy:

1. `myRole` biến mất khỏi `/games/room/:roomId` → chuyển sang `/games/:gameId/me`.
2. Sói không còn thấy `role: "werewolf"` của đồng đội trong `players[]` → phải đọc `teammates` từ `/me` rồi tự ghép ở client.
3. Client cần `gameId` trước khi gọi `/me`. Lấy từ trường `id` của endpoint ván — lần đầu phải gọi tuần tự, sau đó nhớ lại là được.
4. Vòng poll giờ gọi 2 endpoint thay vì 1.

### 9.3. Điều kiện thắng

Giai đoạn này chỉ có 2 phe nên `checkWinCondition()` chỉ xét theo số người còn sống (mục [game-rules.md §5](./game-rules.md)):

- Không còn Sói sống → `winner = VILLAGER`
- Số Sói ≥ số phe Dân còn sống → `winner = WEREWOLF`

Điều kiện thắng của "Người điên" (`winner = THIRD_PARTY`) **chưa xử lý** vì vai `fool` chưa có trong bảng chia vai. Giá trị `THIRD_PARTY` vẫn giữ trong enum `GameWinner` để dành cho lúc nâng cấp.

### 9.4. Giới hạn hiện tại

- Timer chạy trong bộ nhớ process (`SchedulerRegistry` của `@nestjs/schedule`) — server restart giữa ván sẽ làm ván đó không tự chuyển pha nữa, **và người chơi bị nhốt trong phòng** vì `rooms.status` kẹt ở `PLAYING`. Đã ghi thành nợ kỹ thuật ở [PLAN.md §9](../PLAN.md).
- Chỉ có 2 vai (`werewolf`, `villager`) — các vai đặc biệt ở [game-rules.md §2](./game-rules.md) chưa được chia và chưa có endpoint dùng kỹ năng.
- Chưa có WebSocket broadcast — client phải tự poll để biết pha đổi/ai bị giết. Thiết kế gateway tương lai xem [room.md §6](./room.md).

---

## 10. Ghi chú triển khai

- `EventEmitterModule.forRoot()` đăng ký 1 lần, global, ở `AppModule`.
- `RoomsModule` và `GameModule` đều không xuất hiện trong `imports: []` của nhau.
- `RoomsService`/`GameService` inject `EventEmitter2` để `.emit(...)`; listener đặt trong service tương ứng của module nghe, dùng `@OnEvent('event.name')`.
