# Luồng xử lý Phòng chơi (Room)

Module `RoomsModule` quản lý vòng đời một phòng chơi Ma Sói: tạo phòng, tham gia/rời phòng, cấu hình số lượng người chơi, bắt đầu ván, kết thúc ván (quay về trạng thái chuẩn bị) và xoá phòng.

Tài liệu này chỉ thiết kế phần **quản lý phòng** (lobby). Logic chia vai trò, xử lý lượt chơi, ban đêm/ban ngày... thuộc về một module khác (`GameModule`, sẽ thiết kế riêng) và chỉ được nhắc tới ở đây như điểm nối (integration point).

---

## 1. Mô hình dữ liệu

### 1.1. Bảng `rooms`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | serial PK | |
| `code` | varchar(6), unique | Mã phòng ngắn (VD: `A3F9K2`) để mời bạn bè join, không lộ `id` |
| `hostId` | FK → `users.id` | Chủ phòng hiện tại |
| `status` | enum: `WAITING`, `PLAYING` | Trạng thái phòng |
| `maxPlayers` | smallint | Số người chơi, chọn lúc tạo phòng, cố định giá trị `6 \| 8 \| 10 \| 15`, không đổi được sau đó |
| `createdAt` / `updatedAt` | timestamp | |

> Không có bảng `game_modes` riêng — `maxPlayers` lưu thẳng trên `rooms`, chỉ nhận 1 trong 4 giá trị cố định (validate ở `CreateRoomDto` bằng `@IsIn([6,8,10,15])`). Cấu hình vai trò tương ứng mỗi mốc số người chơi (`ROLE_CONFIG_BY_MAX_PLAYERS`) định nghĩa thẳng trong code ở `RoomsModule` (`src/rooms/constants/room-configs.ts`), dùng cho `GameModule` chia vai lúc bắt đầu ván — không cần persist vào DB vì đây là dữ liệu tĩnh, không đổi theo thời gian chạy.

> Không cần cột `deletedAt` (soft delete) — khi chủ phòng xoá phòng thì xoá cứng (hard delete). Nếu sau này cần lưu lịch sử ván chơi thì lưu ở bảng `game_history` riêng (thuộc `GameModule`), không lưu ở `rooms`.

### 1.2. Bảng `room_members`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | serial PK | |
| `roomId` | FK → `rooms.id`, `ON DELETE CASCADE` | |
| `userId` | FK → `users.id` | |
| `isHost` | boolean | Đánh dấu ai đang là chủ phòng (trùng với `rooms.hostId`, lưu thêm để query nhanh danh sách member kèm role) |
| `joinedAt` | timestamp | Dùng để xác định người vào sớm nhất khi cần chuyển quyền host |

Ràng buộc:
- `UNIQUE(roomId, userId)` — 1 user không join trùng 1 phòng 2 lần.
- **Không** cần thêm cột `currentRoomId` trên bảng `users`. Quy tắc "1 user chỉ ở 1 phòng tại 1 thời điểm" được đảm bảo bằng nghiệp vụ: record trong `room_members` chỉ tồn tại khi user đang thực sự ở trong phòng đó (bị xoá ngay khi rời/phòng bị xoá). Muốn biết user có đang ở phòng nào không chỉ cần `SELECT * FROM room_members WHERE userId = ?`.

### 1.3. Quan hệ module

- `RoomsModule` import `UsersModule` (để lấy thông tin user hiển thị trong danh sách phòng) giống cách `AuthModule` đang làm.
- `RoomsModule` export `RoomsService` để `GameModule` (tương lai) gọi `startGame()` / `finishGame()`.

---

## 2. Trạng thái phòng

```
        create()                start()
  (none) ───────► WAITING ───────────────► PLAYING
                    ▲                          │
                    │        finishGame()      │
                    └──────────────────────────┘

  Ở bất kỳ trạng thái nào, host có thể gọi remove() → phòng bị xoá, mọi member bị đẩy ra.
```

- **WAITING**: phòng đang chờ đủ người, cho phép join/leave. `maxPlayers` không thể đổi sau khi tạo phòng.
- **PLAYING**: ván đang diễn ra, khoá join/leave/đổi cấu hình (xem mục 4.6).
- Không có trạng thái `FINISHED` riêng — theo yêu cầu, khi ván kết thúc phòng quay thẳng về `WAITING`, member giữ nguyên để chơi tiếp ván mới.

---

## 3. API

| Method | Path | Auth | Ai được gọi | Mô tả |
|---|---|---|---|---|
| `POST` | `/rooms` | Access token | Bất kỳ user chưa ở phòng nào | Tạo phòng, tự động join làm host |
| `GET` | `/rooms?page=&limit=` | Access token | Bất kỳ | Danh sách phòng đang `WAITING` (lobby browser), có phân trang |
| `GET` | `/rooms/:id` | Access token | Member của phòng | Chi tiết phòng + danh sách member |
| `POST` | `/rooms/join` | Access token | User chưa ở phòng nào | Join bằng `code` |
| `POST` | `/rooms/:id/leave` | Access token | Member của phòng | Rời phòng |
| `POST` | `/rooms/:id/start` | Access token | Host | Bắt đầu ván (`WAITING` → `PLAYING`) |
| `DELETE` | `/rooms/:id` | Access token | Host | Xoá phòng, kick toàn bộ member |

`POST /rooms/:id/finish` **không** phải REST endpoint public — đây là method nội bộ `RoomsService.finishGame(roomId)` được `GameModule` gọi trực tiếp (dependency injection) khi ván kết thúc, không cần expose qua HTTP.

---

## 4. Luồng nghiệp vụ

### 4.0. Danh sách phòng (phân trang)

1. Client gửi query `page` (mặc định `1`) và `limit` (mặc định `10`, tối đa `50` — chặn cứng ở service tránh client xin quá nhiều record 1 lần).
2. Chỉ trả các phòng `status = WAITING`, sắp xếp `createdAt DESC` (phòng mới nhất lên đầu).
3. Response dạng `{ items, total, page, limit, totalPages }`.
4. `page`/`limit` không hợp lệ (không phải số) → validate lỗi 400 ở `ListRoomsDto` (`@IsNumberString`); giá trị hợp lệ nhưng vô lý (VD `page=0`, `limit=-5`) → service tự fallback về mặc định thay vì lỗi, tránh vỡ luồng client.

### 4.1. Tạo phòng

1. Client gửi `maxPlayers` — chỉ nhận 1 trong 4 giá trị cố định `6 | 8 | 10 | 15` (validate bằng `@IsIn`); sai giá trị → lỗi validation 400, không cần `NotFoundException` vì không tra cứu bảng nào.
2. Kiểm tra user gọi request **chưa** có record nào trong `room_members` — nếu có, throw `ConflictException` ("Bạn đang ở trong một phòng khác").
3. Sinh `code` ngẫu nhiên (6 ký tự, bảng chữ bỏ ký tự dễ nhầm như `0/O`, `1/I`), retry nếu trùng unique constraint.
4. Tạo `Room` với `status = WAITING`, `hostId = user.id`, `maxPlayers` từ bước 1. Bước 2–4 nằm trong 1 transaction để đảm bảo không tạo phòng "mồ côi" (phòng không có member) nếu bước tạo `RoomMember` thất bại.
5. Tạo `RoomMember` cho chính user đó, `isHost = true`.
6. Trả về thông tin phòng (kèm `code` để mời bạn bè).

### 4.2. Tham gia phòng

1. Client gửi `code`.
2. Service tìm phòng theo `code`; không tồn tại → `NotFoundException`.
3. Kiểm tra `status === WAITING`; nếu đang `PLAYING` → `ConflictException` ("Ván đang diễn ra, không thể vào").
4. Kiểm tra user chưa ở phòng nào khác (như bước tạo phòng).
5. Kiểm tra số lượng member hiện tại `< maxPlayers`.
6. Bước 3–5 phải nằm trong **1 transaction** với lock trên row `rooms` (xem mục 5 — Concurrency) để tránh 2 request join cùng lúc làm phòng vượt quá `maxPlayers`.
7. Insert `RoomMember` mới, `isHost = false`.
8. Broadcast sự kiện `room:member_joined` cho các client đang xem phòng đó (xem mục 6).

### 4.3. Rời phòng

1. Xoá record `RoomMember` của user trong phòng.
2. Nếu user vừa rời **không phải** host → xong, broadcast `room:member_left`.
3. Nếu user vừa rời **là host**:
   - Còn member khác → chuyển host cho member có `joinedAt` sớm nhất còn lại (`isHost = true`, cập nhật `rooms.hostId`), broadcast `room:host_changed`.
   - Không còn ai → tự động xoá phòng (dọn rác), broadcast `room:deleted`.
4. Nếu phòng đang `PLAYING` khi có người rời: **không** cho rời qua API này (chặn ở bước 1 bằng kiểm tra `status`), trả `ConflictException`. Việc "thoát giữa ván" (rớt mạng, bỏ cuộc) là bài toán của `GameModule` (đánh dấu người chơi "disconnected"/"đã chết" trong state của ván), `RoomsModule` không xử lý — tránh phá vỡ số lượng vai trò đã chia.

### 4.4. Đổi cấu hình phòng

`maxPlayers` **không được phép thay đổi** sau khi tạo phòng. Nếu host muốn đổi số người chơi, phải xoá phòng và tạo lại.

### 4.5. Bắt đầu ván (Start)

1. Chỉ host mới gọi được.
2. `status` phải đang `WAITING`, nếu không → `ConflictException`.
3. Số member hiện tại phải **đúng bằng** `room.maxPlayers` — thiếu người → `BadRequestException` ("Cần đủ N người để bắt đầu").
4. Set `status = PLAYING`.
5. Gọi sang `GameModule` (ví dụ `GameService.createGameForRoom(roomId, memberIds, roleConfig)`) để khởi tạo state ván chơi, chia vai trò theo `ROLE_CONFIG_BY_MAX_PLAYERS[room.maxPlayers]` (định nghĩa tĩnh trong code, xem mục 1.1) — nằm ngoài phạm vi tài liệu này.
6. Broadcast `room:started`.

### 4.6. Kết thúc ván (Finish)

1. `GameModule` gọi `RoomsService.finishGame(roomId)` khi ván kết thúc (có người thắng, hoặc bị huỷ giữa chừng).
2. Set `status = WAITING`. Member giữ nguyên, host giữ nguyên.
3. Broadcast `room:finished` để client quay lại màn hình phòng chờ.

### 4.7. Xoá phòng

1. Chỉ host mới gọi được.
2. Cho phép xoá ở cả `WAITING` lẫn `PLAYING` (chủ phòng huỷ ván giữa chừng) — nếu đang `PLAYING`, gọi `GameModule` để huỷ state ván trước khi xoá phòng.
3. Xoá toàn bộ `RoomMember` (cascade), xoá `Room`.
4. Broadcast `room:deleted` tới tất cả member để client tự động thoát ra màn hình lobby.

---

## 5. Xử lý đồng thời (concurrency)

Join và start đều đọc-rồi-ghi trên cùng 1 row `rooms`, có thể có race condition khi nhiều người bấm "Vào phòng" cùng lúc lúc phòng chỉ còn 1 chỗ trống. Xử lý:

- Bọc trong TypeORM transaction, dùng pessimistic lock:
  ```ts
  await this.dataSource.transaction(async (manager) => {
    const room = await manager.findOne(Room, {
      where: { id: roomId },
      lock: { mode: 'pessimistic_write' },
    });
    // kiểm tra status + đếm member trong cùng transaction
    // insert RoomMember trong cùng transaction
  });
  ```
- Kết hợp thêm `UNIQUE(roomId, userId)` ở tầng DB làm lớp bảo vệ cuối cùng chống double-join do bug ở tầng service.

---

## 6. Real-time (khuyến nghị dùng WebSocket)

Vì nhiều người chơi cần thấy trạng thái phòng cập nhật tức thời (ai vừa vào/ra, ai làm host, phòng bắt đầu/kết thúc/bị xoá), nên bổ sung một `RoomsGateway` (Socket.IO qua `@nestjs/websockets` + `@nestjs/platform-socket.io`) bên cạnh REST:

- Mọi **hành động** (tạo/join/leave/start/xoá) vẫn đi qua REST endpoint như bảng ở mục 3, tận dụng luôn `JwtAuthGuard` global đang có sẵn — không phải viết lại logic auth cho WS.
- Sau khi REST handler xử lý xong và commit DB, `RoomsService` gọi `RoomsGateway` để **broadcast** kết quả tới các socket đã join Socket.IO room tương ứng (`room:<roomId>`).
- Xác thực kết nối WebSocket: lấy access token từ `socket.handshake.auth.token`, verify bằng cùng `JwtStrategy`/`JwtService` đang dùng cho REST, gắn `socket.data.userId`.
- Khi client mở màn hình phòng, gọi `socket.emit('room:subscribe', { roomId })` → gateway kiểm tra user có phải member của phòng đó không (query `room_members`) rồi mới `socket.join('room:' + roomId)`.
- Các event broadcast: `room:member_joined`, `room:member_left`, `room:host_changed`, `room:settings_updated`, `room:started`, `room:finished`, `room:deleted`.

Cách chia REST (ghi) + WebSocket (broadcast đọc) giúp giữ nguyên style REST hiện tại của dự án, tránh phải xây dựng toàn bộ command layer qua WebSocket.

---

## 7. Các vấn đề biên (edge cases)

| Tình huống | Cách xử lý |
|---|---|
| User đang ở phòng A, cố tạo/join phòng B | Chặn ở service, `ConflictException` |
| 2 người cùng join vào chỗ trống cuối cùng | Pessimistic lock trong transaction (mục 5) |
| Host rời phòng | Tự động chuyển host cho người vào sớm nhất, hoặc xoá phòng nếu không còn ai |
| Host mất kết nối (không chủ động rời) | Ngoài phạm vi `RoomsModule` REST — xử lý ở tầng WebSocket: khi socket `disconnect` quá thời gian timeout (VD 30s) không reconnect, tự động gọi `leaveRoom()` giúp user đó |
| Start khi thiếu người | `BadRequestException`, chặn ở bước 4.5.3 |
| Host muốn đổi số người chơi (`maxPlayers`) | Không hỗ trợ — xoá phòng và tạo lại |
| Rời phòng khi đang `PLAYING` | Chặn qua REST; do `GameModule` xử lý (đánh dấu disconnected) |
| Join phòng đã đủ người hoặc đang chơi | `ConflictException` |

---

## 8. Gợi ý mở rộng sau này (ngoài phạm vi hiện tại)

- Kick member (host chủ động đuổi 1 người, khác với việc người đó tự rời).
- Phòng riêng tư có mật khẩu.
- Ghế ngồi cố định (seat index) thay vì danh sách member không thứ tự — hữu ích nếu UI hiển thị bàn tròn.
- Lưu lịch sử ván chơi (`game_history`) để thống kê thắng/thua — nên tách bảng riêng ở `GameModule`, không nhét vào `rooms`.
