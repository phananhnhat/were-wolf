# PLAN — Werewolf API

Trạng thái các chức năng đã hoàn thành trong dự án (NestJS + TypeORM + PostgreSQL).

Cập nhật: 2026-09-07

---

## 1. Tổng quan kiến trúc

| Thành phần | Trạng thái | Ghi chú |
|---|---|---|
| NestJS 11 + TypeORM + PostgreSQL | ✅ Xong | `TypeOrmModule.forRootAsync`, đọc `DATABASE_URL` qua `ConfigService` |
| `ConfigModule` global (`.env`) | ✅ Xong | `isGlobal: true`, `getOrThrow` để fail-fast lúc khởi động |
| `EventEmitterModule` global | ✅ Xong | RoomsModule ↔ GameModule giao tiếp qua event, tránh circular dependency |
| Swagger UI tại `/api` | ✅ Xong | `DocumentBuilder` + `addBearerAuth()` (`src/main.ts`) |
| `ValidationPipe({ whitelist: true })` global | ✅ Xong | DTO tự loại bỏ field lạ |
| `ClassSerializerInterceptor` global | ✅ Xong | `@Exclude()` trên `User.password` được tôn trọng ở mọi response |
| `JwtAuthGuard` đăng ký global qua `APP_GUARD` | ✅ Xong | Mọi route mặc định cần access token, mở bằng `@Public()` |
| `synchronize: true` | ⚠️ Còn bật | TypeORM so entity với schema thật lúc khởi động rồi tự `CREATE`/`ALTER`/`DROP` cho khớp. Đỡ phải viết migration lúc dev, nhưng **tự drop cột/bảng không hỏi** (đổi tên cột = mất dữ liệu) và không rollback được → phải tắt + viết migration trước khi lên production |

Các bảng đang được đăng ký entity: `users`, `user_sessions`, `rooms`, `room_members`, `games`, `game_players`, `game_votes`.

---

## 2. Xác thực & tài khoản (`AuthModule`)

Cơ chế dual-token (access + refresh) có rotation, session lưu trong bảng `user_sessions`.

| Chức năng | Endpoint | Trạng thái |
|---|---|---|
| Đăng ký người dùng | `POST /auth/register` | ✅ Xong |
| Đăng nhập | `POST /auth/login` | ✅ Xong |
| Làm mới cặp token (rotation) | `POST /auth/refresh` | ✅ Xong |
| Đăng xuất (huỷ 1 session) | `POST /auth/logout` | ✅ Xong |
| Đổi mật khẩu (huỷ toàn bộ session) | `POST /auth/change-password` | ✅ Xong |

Chi tiết đã làm:

- Hash mật khẩu bằng `bcryptjs` (cost 10) trước khi lưu.
- Kiểm tra trùng `username` / `email` khi đăng ký.
- Mỗi lần cấp token sinh `sessionId` (UUID) nhúng vào refresh token (`payload.sid`), lưu bản ghi `user_sessions` với `tokenHash` đã bcrypt + `expiresAt` 7 ngày.
- Refresh: `JwtRefreshGuard` + `JwtRefreshStrategy` đọc refresh token từ header `Authorization: Bearer`, cấp cặp mới rồi **xoá session cũ** (rotation).
- Logout: verify refresh token, chỉ xoá đúng session tương ứng (`sid`) → các thiết bị khác vẫn đăng nhập.
- Đổi mật khẩu: đối chiếu mật khẩu hiện tại, rồi `sessionsRepo.delete({ userId })` → **đăng xuất mọi thiết bị**.
- Decorator `@Public()` (bỏ qua guard global) và `@CurrentUser()` (lấy `req.user`).

---

## 3. Người dùng (`UsersModule`)

| Chức năng | Endpoint | Trạng thái |
|---|---|---|
| Danh sách người dùng | `GET /users` | ✅ Xong |
| Chi tiết người dùng | `GET /users/:id` | ✅ Xong |
| Cập nhật thông tin (chỉ chính chủ) | `PUT /users/:id` | ✅ Xong |

Entity `User`: `id`, `name`, `username` (unique), `email` (unique), `address`, `gender`, `password` (`@Exclude()`), `createdAt`.

`UsersService` còn có `create` / `updatePassword` / `remove` / `findByUsername` / `findByEmail` dùng nội bộ (chủ yếu cho `AuthModule`), chưa expose hết qua HTTP.

**Phân quyền sửa hồ sơ**: `UsersService.update(actorId, id, dto)` so `actorId` (lấy từ access token qua `@CurrentUser()`) với `id` trên URL, lệch nhau thì `ForbiddenException` → user chỉ sửa được hồ sơ của chính mình.

> ⚠️ `GET /users` vẫn trả toàn bộ user kèm `email` / `address` cho bất kỳ ai đăng nhập. Chưa có role admin — nếu sau này cần admin sửa hồ sơ người khác thì thêm cột `role` vào `User` rồi nới điều kiện trong `update()`.

---

## 4. Phòng chơi (`RoomsModule`)

| Chức năng | Endpoint | Trạng thái |
|---|---|---|
| Danh sách phòng đang chờ (phân trang) | `GET /rooms?page=&limit=` | ✅ Xong |
| Phòng mà tôi đang ở (khôi phục sau reload) | `GET /rooms/me` | ✅ Xong |
| Chi tiết phòng + danh sách thành viên | `GET /rooms/:id` | ✅ Xong |
| Tạo phòng | `POST /rooms` | ✅ Xong |
| Vào phòng bằng mã | `POST /rooms/join` | ✅ Xong |
| Rời phòng | `POST /rooms/:id/leave` | ✅ Xong |
| Bắt đầu ván | `POST /rooms/:id/start` | ✅ Xong |
| Xoá phòng | `DELETE /rooms/:id` | ✅ Xong |

Chi tiết đã làm:

- **Mã phòng 6 ký tự** sinh ngẫu nhiên từ bảng chữ bỏ ký tự dễ nhầm (`0/O`, `1/I`); retry tối đa 5 lần khi đụng unique constraint (`23505`).
- **Số người chơi cố định** `6 | 8 | 10 | 15` (`@IsIn(ALLOWED_MAX_PLAYERS)`), không đổi được sau khi tạo.
- **Tạo phòng chạy trong transaction**: chặn user đang ở phòng khác, tạo `rooms` + `room_members` (host) nguyên tử.
- **Join chạy trong transaction có `pessimistic_write` lock** trên `rooms`: chặn race condition vượt quá `maxPlayers`, chặn join khi phòng đang `PLAYING`, chặn user đã ở phòng khác.
- **Rời phòng**: cấm rời khi ván đang chạy; nếu host rời thì **tự chuyển quyền host** cho người vào sớm nhất, còn nếu hết người thì xoá luôn phòng.
- **Bắt đầu ván**: chỉ host, phòng phải `WAITING` và phải **đủ đúng** `maxPlayers` người; đổi status → `PLAYING` rồi phát event `room.started`.
- **Xoá phòng**: chỉ host, hard delete (cascade xoá `room_members`), phát event `room.deleted`.
- **Lắng nghe event từ GameModule**: `game.finished` → đưa phòng về `WAITING`; `game.start_failed` → rollback status về `WAITING`.
- Chỉ thành viên trong phòng mới xem được `GET /rooms/:id` (`ForbiddenException` nếu không phải member).

---

## 5. Ván chơi (`GameModule`)

| Chức năng | Endpoint | Trạng thái |
|---|---|---|
| Xem trạng thái ván theo phòng | `GET /games/room/:roomId` | ✅ Xong |
| Xem thông tin của chính mình trong ván | `GET /games/:gameId/me` | ✅ Xong |
| Bỏ phiếu / đổi phiếu | `POST /games/:gameId/vote` | ✅ Xong |
| Xem kiểm phiếu lượt hiện tại | `GET /games/:gameId/votes` | ✅ Xong |
| Tiên tri soi 1 người trong đêm | `POST /games/:gameId/seer/check` | ✅ Xong |
| Lịch sử soi của chính mình | `GET /games/:gameId/seer/checks` | ✅ Xong |
| Bảo vệ che 1 người trong đêm | `POST /games/:gameId/guardian/protect` | ✅ Xong |
| Lịch sử che của chính mình | `GET /games/:gameId/guardian/protects` | ✅ Xong |

Thiết kế kỹ thuật: [docs/game-rounds.md](./docs/game-rounds.md). Luật gốc: [docs/game-rules.md](./docs/game-rules.md).

Phần dưới đây mô tả **luật vận hành của một ván**, không đi vào cách triển khai.

### 5.1. Vòng đời một ván

```
chủ phòng bấm bắt đầu
   │
   ├─ chia vai ngẫu nhiên, mọi người còn sống
   │
   ▼
LƯỢT 1 ──► LƯỢT 2 ──► LƯỢT 3 ──► ...   (chạy tự động, không cần ai bấm gì)
   │
   ▼
một phe thoả điều kiện thắng
   │
   ▼
ván KẾT THÚC ──► phòng quay về trạng thái chờ, giữ nguyên thành viên, chơi lại được ngay
```

Một ván có 3 trạng thái:

| Trạng thái | Khi nào |
|---|---|
| Đang chơi | Từ lúc bắt đầu tới lúc có phe thắng |
| Kết thúc | Một phe thoả điều kiện thắng — có ghi phe thắng |
| Bị huỷ | Chủ phòng xoá phòng giữa ván — không có phe thắng |

Điều kiện để bắt đầu: phòng phải **đủ đúng** số người đã chọn lúc tạo phòng (6/8/10/15), và chỉ chủ phòng bấm được. Nếu việc khởi tạo ván thất bại, phòng được trả về trạng thái chờ để không bị kẹt.

### 5.2. Vai trò và phe

Hiện có **4 vai**, chia ngẫu nhiên đều lúc bắt đầu và **cố định suốt ván**:

| Số người | Sói | Dân thường | Bảo vệ | Tiên tri |
|---|---|---|---|---|
| 6 | 1 | 4 | 1 | 0 |
| 8 | 2 | 4 | 1 | 1 |
| 10 | 2 | 6 | 1 | 1 |
| 15 | 3 | 10 | 1 | 1 |

Hai phe: **phe Sói** và **phe Dân**. Mọi vai không phải Sói đều thuộc phe Dân. Sói biết nhau ngay từ đầu; Dân không biết ai là ai.

**Tiên tri** thuộc phe Dân. Mỗi đêm được soi đúng **1 người** để biết người đó **có phải Sói hay không** — chỉ nhị phân, không biết vai cụ thể. Kết quả chỉ mình Tiên tri thấy, và **không rút lại hay đổi mục tiêu được** (khác bỏ phiếu: vừa gọi là đã biết đáp án). Không được tự soi mình, không soi người đã chết. Xem [docs/role-tien-tri.md](./docs/role-tien-tri.md).

**Bảo vệ** cũng thuộc phe Dân. Mỗi đêm chọn **1 người** để che; nếu Sói cắn đúng người đó thì không ai chết. Không được tự che mình, và **không được che trùng một người 2 đêm liên tiếp**. Che chỉ chặn được vết cắn ban đêm, **không** cứu được người bị treo cổ ban ngày. Bảo vệ không bao giờ biết mình che trúng hay trượt — biết được tức là biết luôn Sói nhắm ai. Xem [docs/role-bao-ve.md](./docs/role-bao-ve.md).

### 5.3. Cấu trúc một lượt

Một lượt gồm **2 pha, mỗi pha 60 giây** — tổng 120 giây. Cả hai pha đều là pha bỏ phiếu; việc bàn bạc diễn ra ngay trong 60 giây đó, không có pha thảo luận riêng.

```
        ┌──────────── LƯỢT N (120 giây) ────────────┐
        │                                            │
   ───► │   BAN ĐÊM  (60s)   →    BAN NGÀY  (60s)    │ ───►  LƯỢT N+1
        │   chỉ Sói bỏ phiếu      cả làng bỏ phiếu   │
        │          │                     │           │
        └──────────┼─────────────────────┼───────────┘
                   ▼                     ▼
            người nhiều phiếu     người nhiều phiếu
            nhất bị cắn chết      nhất bị treo cổ
```

**Ván luôn mở màn bằng pha ban đêm của lượt 1.**

| Pha | Dài | Ai được bỏ phiếu | Ai xem được kiểm phiếu | Ý nghĩa |
|---|---|---|---|---|
| Ban đêm | 60s | Chỉ Sói còn sống | Chỉ Sói | Sói bàn kín, chọn người để cắn |
| Ban ngày | 60s | Mọi người còn sống | Mọi người trong ván | Cả làng tranh luận, chọn người treo cổ |

### 5.4. Luật bỏ phiếu

- Mỗi người **chỉ có 1 phiếu hiệu lực trong một pha**. Bỏ phiếu lại nhiều lần trong cùng pha là **đổi phiếu**, không cộng dồn — chỉ lựa chọn cuối cùng được tính.
- Phiếu của pha ban đêm và pha ban ngày trong cùng một lượt được đếm **riêng**, không ảnh hưởng nhau.
- Người đã chết **không được bỏ phiếu**.
- **Không được bỏ phiếu cho người đã chết.**
- Ban đêm, người không phải Sói **không được bỏ phiếu và không được xem kiểm phiếu**.
- Không bắt buộc phải bỏ phiếu — im lặng cũng là một lựa chọn.
- Hiện **không cấm** tự bỏ phiếu cho chính mình, và Sói **không bị cấm** bỏ phiếu cho Sói khác (xem §8).

### 5.5. Xử lý khi hết giờ một pha

Hết 60 giây, hệ thống làm lần lượt:

1. **Kiểm phiếu** của pha vừa đóng.
2. **Xác định nạn nhân**: người có số phiếu cao nhất.
   - **Hoà phiếu** (từ 2 người trở lên cùng số phiếu cao nhất) → **không ai chết**.
   - **Không ai bỏ phiếu** → **không ai chết**.
3. Nạn nhân (nếu có) bị **đánh dấu đã chết**, không thể hồi sinh.
4. **Xét điều kiện thắng** (§5.6). Nếu thoả → ván kết thúc ngay tại đây, không mở pha mới.
5. Nếu chưa ai thắng → mở pha kế tiếp. Sau pha ban ngày thì sang lượt mới.

### 5.6. Điều kiện thắng

Xét **sau mỗi lần có người chết**, dựa hoàn toàn trên số người **còn sống**:

| Điều kiện | Kết quả |
|---|---|
| Không còn Sói nào sống | **Phe Dân thắng** |
| Số Sói sống ≥ số người phe Dân sống | **Phe Sói thắng** |

Điều kiện thứ hai phản ánh luật thực tế: khi Sói đông ngang Dân thì Dân không còn khả năng bỏ phiếu lật ngược, coi như thua luôn, không cần chơi tiếp.

Chưa có kết quả hoà và chưa có phe thứ ba (dành cho vai Người điên khi nâng cấp).

### 5.7. Thông tin mỗi người được nhìn thấy

Vai trò là bí mật. Thông tin được chia làm hai nhóm rạch ròi, tương ứng hai endpoint riêng biệt (xem [game.md §9.2](./docs/game.md)):

**Nhóm 1 — trạng thái ván, ai trong ván cũng thấy như nhau:** pha hiện tại, số thứ tự lượt, thời điểm pha kết thúc để đếm ngược, danh sách người chơi kèm còn sống hay đã chết, và phe thắng khi ván xong.

Trong nhóm này, vai trò chỉ hiện khi **khách quan đã công khai**:

| Trường hợp | Vì sao |
|---|---|
| Người đó đã chết | Vai được công khai lúc chết, cho **tất cả mọi người** thấy như nhau |
| Ván đã kết thúc | Công khai toàn bộ để tổng kết |

> Điều kiện "đã chết" xét trên **người đang được liệt kê**, không phải người đang xem. Một người chết đi thì vai của *họ* lộ ra cho cả làng — chứ *họ* không vì thế mà nhìn thấy vai của những người còn sống.

**Nhóm 2 — thông tin riêng của từng người, mỗi người thấy một kiểu:** vai của chính mình, danh sách đồng đội (chỉ Sói mới có — đây là phần "Sói biết nhau"), phiếu mình đang bỏ, và trạng thái kỹ năng riêng nếu có vai đặc biệt.

Tách như vậy để endpoint trạng thái ván **hoàn toàn không phụ thuộc người xem** — hai người cùng ván gọi lên nhận phản hồi y hệt nhau. Nhờ đó việc rà soát rò rỉ bí mật chỉ còn gói gọn ở đúng một chỗ, thay vì phải soi từng trường trong một phản hồi trộn lẫn.

### 5.8. Nhịp chuyển pha

Mỗi ván có đồng hồ riêng, chạy độc lập với các ván khác — hai phòng bắt đầu lệch nhau 10 giây thì pha của chúng cũng luôn lệch nhau 10 giây. Hệ thống tự chuyển pha khi hết giờ, người chơi không phải bấm gì.

> ⚠️ **Nợ kỹ thuật**: lịch chuyển pha không được lưu bền — khởi động lại server thì ván đang chạy đứng vĩnh viễn **và người chơi bị nhốt trong phòng**. Xem §9.

---

## 6. `GroupsModule` — đã xoá

Là code scaffold demo (CRUD in-memory, `interface Group` thuần TS, không có bảng DB, không dùng `@CurrentUser()`, DTO không có decorator validation), không được dùng ở bất kỳ đâu trong luồng game. Đã xoá `src/groups/`, `docs/group.md` và import trong `AppModule`.

Nếu sau này muốn làm "bang hội / nhóm bạn bè" thì viết mới theo chuẩn của `RoomsModule`: `@Entity()` thật, `ownerId`, `@CurrentUser()` ở mọi route, DTO có validation, và kiểm tra quyền trong service.

---

## 7. Việc chưa làm (backlog)

| Hạng mục | Ghi chú | Xác nhận |
|---|---|---|
| Realtime (WebSocket / SSE) | Hiện client phải poll `GET /games/room/:roomId` để biết pha đổi | Chưa cần |
| **Nợ kỹ thuật — ván đứng khi restart** | Xem §9 bên dưới | Chấp nhận, xử lý sau |
| Vai trò đặc biệt | Đã có Tiên tri (`seer`) và Bảo vệ (`guardian`). Còn `witch`, `hunter`, `fool` — xem [luat-choi.md §9](./docs/luat-choi.md) về thứ tự nên thêm | Đang làm dần |
| Chat trong phòng | Chưa có | Chưa làm |
| Lịch sử ván đấu / thống kê | Chưa có bảng `game_history` | Chưa làm |
| Role admin | Chưa có cột `role`; `GET /users` đang lộ email/address của mọi người | Tạm để đó, làm sau |
| Migration | Đang dựa vào `synchronize: true` — TypeORM tự `ALTER`/`DROP` schema theo entity lúc khởi động. Tiện lúc dev, mất dữ liệu lúc production | Chưa làm |
| Test | Mới có `app.controller.spec.ts` mặc định | Không cần |
| Dọn `GroupsModule` | Đã xoá `src/groups/`, `docs/group.md` và import trong `AppModule` | ✅ Xong |

---

## 8. Còn thiếu gì để hoàn thiện logic ván chơi

Rà soát luật ở §5 — vòng lượt đã chạy đúng và ván kết thúc được, nhưng **chưa đủ để chơi thật**. Dưới đây là các lỗ hổng theo thứ tự ưu tiên.

| # | Thiếu gì | Mức độ | Cần thêm dữ liệu? |
|---|---|---|---|
| 1 | Người chơi không biết chuyện gì vừa xảy ra | 🔴 Chặn việc chơi thật | Có |
| 2 | Không phân biệt chết vì bị cắn hay bị treo cổ | 🔴 Chặn #1 và các vai sau này | Có |
| 3 | Người bỏ ngang / mất mạng giữa ván | 🔴 Chắc chắn gặp | Có |
| 4 | Ván có thể không bao giờ kết thúc | 🟠 Lỗi luật | Không — chỉ cần chốt luật |
| 5 | Không có cách kết thúc ván sớm | 🟠 Khó chịu khi chơi | Có |
| 6 | Vài luật bỏ phiếu còn bỏ ngỏ | 🟡 Cần chốt | Không — chỉ cần chốt luật |
| 7 | Không lưu lại kết quả ván | 🟡 Mất dữ liệu | Có |
| 8 | Tỉ lệ Sói/Dân chưa cân | 🟡 Cân bằng | Không |

---

### 8.1. 🔴 Người chơi không biết chuyện gì vừa xảy ra

**Vấn đề.** Hết pha, người chơi chỉ thấy trạng thái sống/chết của mọi người **đổi âm thầm**. Không có câu nào nói "đêm qua An bị Sói cắn", "cả làng đã treo cổ Bình", hay "hoà phiếu nên đêm nay không ai chết". Muốn biết ai vừa chết thì client phải **tự so sánh** danh sách người chơi với lần gọi trước — mà nếu người chơi mở app muộn hoặc F5 thì mất luôn thông tin đó.

**Vì sao nghiêm trọng.** Ma Sói là trò suy luận. Toàn bộ lập luận của người chơi dựa trên lịch sử: ai chết lượt nào, chết ban đêm hay ban ngày, ai từng bỏ phiếu cho ai. Không có lịch sử thì không có gì để suy luận — game mất phần lõi.

**Hướng xử lý.** Cần khái niệm **nhật ký sự kiện của ván**: mỗi lần có chuyện xảy ra thì ghi lại một dòng, người chơi đọc được từ đầu ván. Tối thiểu cần ghi:

- Ván bắt đầu (mấy người, mấy Sói)
- Mỗi pha mở ra
- Kết quả kiểm phiếu cuối pha: ai chết, hay hoà phiếu / không ai bỏ phiếu nên không ai chết
- Ván kết thúc, phe nào thắng, vai của từng người

Cần cân nhắc: có công khai **chi tiết ai bỏ phiếu cho ai** sau khi pha đóng không, hay chỉ công khai kết quả. Phiếu ban ngày vốn công khai nên ghi lại được; phiếu ban đêm của Sói thì **không được lộ** cho phe Dân kể cả sau khi pha kết thúc.

---

### 8.2. 🔴 Không phân biệt nguyên nhân chết

**Vấn đề.** Hiện chỉ ghi nhận "còn sống / đã chết". Không biết người đó bị Sói cắn ban đêm hay bị làng treo cổ ban ngày, cũng không biết chết ở lượt thứ mấy.

**Vì sao quan trọng.** Ba lý do:

1. Không có thông tin này thì **không viết được nhật ký ở §8.1**.
2. Rất nhiều vai sắp thêm phụ thuộc trực tiếp vào nguyên nhân chết: **Người điên** chỉ thắng khi **bị treo cổ** (bị cắn thì không), **Thợ săn** được bắn một phát khi chết, **Phù thuỷ** cứu được người **bị cắn**.
3. Tổng kết ván (§8.7) cần biết ai sống được tới lượt mấy.

**Hướng xử lý.** Với mỗi người chơi, ghi thêm: chết ở lượt nào, chết ở pha nào, và nguyên nhân (bị cắn / bị treo cổ). Đây là nền móng nên làm **trước** khi thêm bất kỳ vai đặc biệt nào.

---

### 8.3. 🔴 Người bỏ ngang hoặc mất mạng giữa ván

**Vấn đề.** Không có khái niệm "đang kết nối". Người đóng app, hết pin, rớt mạng vẫn được tính là **còn sống** và vẫn nằm trong công thức tính điều kiện thắng, nhưng **không bao giờ bỏ phiếu**. Luật hiện tại cũng cấm rời phòng khi ván đang chạy, nên họ không có cách nào thoát ra hợp lệ.

**Hệ quả.** Phòng 6 người có 1 Sói: chỉ cần 2 Dân biến mất là Sói gần như thắng chắc, vì phe Dân mất 2 lá phiếu mà vẫn bị tính đủ đầu người. Ván vẫn chạy hết lượt này tới lượt khác dù thực tế chỉ còn vài người ngồi đó.

**Hướng xử lý — cần chốt luật trước:**

- Coi người mất kết nối là gì? Vẫn sống bình thường (như hiện tại), hay bị đánh dấu vắng mặt?
- Nếu vắng mặt quá N lượt liên tiếp không bỏ phiếu thì có tự loại khỏi ván không?
- Có cho phép **chủ động đầu hàng / thoát ván** không? Nếu có thì người đó chết luôn, hay chỉ bị đánh dấu bỏ cuộc và không tính vào điều kiện thắng?

Câu hỏi "không tính vào điều kiện thắng" quan trọng nhất: nếu 3 người bỏ cuộc thì công thức "số Sói ≥ số Dân" phải tính trên người **còn chơi thật**, chứ không phải người **còn sống trên giấy**.

---

### 8.4. 🟠 Ván có thể không bao giờ kết thúc

**Vấn đề.** Luật hiện tại: hoà phiếu → không ai chết. Nếu người chơi cứ hoà phiếu liên tục (vô tình hoặc cố ý), **không ai chết mãi mãi** và ván lặp vô hạn. Không có trần số lượt, không có luật hoà.

**Ví dụ dễ gặp**: phòng 6 người còn 2 Dân 1 Sói. Ban ngày 3 người bỏ phiếu 3 hướng khác nhau → hoà → không ai chết. Ban đêm Sói cắn 1 Dân → còn 1 Dân 1 Sói → Sói thắng. Trường hợp này vẫn thoát được. Nhưng nếu **không ai bỏ phiếu cả** (mọi người AFK — xem §8.3) thì ván chạy vô tận.

**Hướng xử lý.** Chọn một trong:

- **Trần số lượt** (ví dụ 20 lượt) — quá thì kết thúc. Nhưng phải chốt: ai thắng? Cần thêm kết quả **hoà** hay xử phe Dân thắng?
- **Hoà thì bốc ngẫu nhiên một người trong nhóm hoà** — luôn có người chết mỗi lượt, ván chắc chắn kết thúc. Đổi lại người chơi dễ ức chế vì chết oan.
- **Bỏ phiếu lại giữa nhóm hoà** — công bằng nhất nhưng thêm một pha nữa.

Liên quan chặt tới §8.3: nếu xử lý được người AFK thì kịch bản "không ai bỏ phiếu" gần như biến mất, và trần số lượt chỉ còn là lưới an toàn.

---

### 8.5. 🟠 Không có cách kết thúc ván sớm

**Vấn đề.** Ván đã bắt đầu thì phải chạy tới khi một phe thắng. Nếu 5/6 người bỏ đi, những người còn lại vẫn phải ngồi chờ hết lượt này tới lượt khác. Lối thoát duy nhất hiện nay là **chủ phòng xoá hẳn phòng** — mà làm thế thì cả nhóm mất phòng, phải tạo lại và mời lại từ đầu.

**Hướng xử lý.** Cần một cơ chế nhẹ hơn "xoá phòng":

- Bỏ phiếu huỷ ván: quá bán người còn sống đồng ý thì ván dừng, không tính phe thắng, phòng quay về trạng thái chờ.
- Hoặc cho phép chủ phòng dừng ván mà **không** xoá phòng.

---

### 8.6. 🟡 Vài luật bỏ phiếu còn bỏ ngỏ

Những điểm này hiện đang chạy theo mặc định "không cấm", chưa phải quyết định có chủ đích:

| Câu hỏi | Hiện tại | Cần chốt |
|---|---|---|
| Được tự bỏ phiếu cho chính mình? | Được | Luật Ma Sói thường **cấm**. Nên cấm? |
| Sói được bỏ phiếu cắn Sói khác? | Được | Vô lý về mặt luật. Nên cấm? |
| Có "bỏ phiếu trắng" (chủ động không treo ai) không? | Không có — chỉ có cách im lặng | Im lặng và bỏ phiếu trắng khác nhau về ý nghĩa. Có cần tách? |
| Người đã chết có xem được kiểm phiếu không? | Sói đã chết vẫn xem được phiếu ban đêm | Chấp nhận được (chết rồi thì đã biết hết đồng đội), nhưng nên ghi rõ là luật cố ý |
| Có được rút phiếu sau khi đã bỏ không? | Không — chỉ đổi sang người khác | Có cần cho rút hẳn? |

---

### 8.7. 🟡 Không lưu lại kết quả ván

**Vấn đề.** Ván kết thúc thì chỉ còn lại phe thắng. Không có bảng tổng kết: ai vai gì, ai chết lượt mấy, ai thắng. Người chơi không xem lại được ván vừa chơi, cũng không có thống kê "đã chơi bao nhiêu ván, thắng bao nhiêu, làm Sói mấy lần".

**Hướng xử lý.** Sau khi có §8.1 và §8.2 thì dữ liệu đã đủ — chỉ cần một màn hình tổng kết cuối ván và một chỗ lưu lịch sử để tra lại sau.

---

### 8.8. 🟡 Tỉ lệ Sói/Dân chưa cân

Cấu hình hiện tại (§5.2) so với tỉ lệ thường thấy trong Ma Sói (khoảng 1 Sói / 4 người):

| Số người | Sói hiện tại | Tỉ lệ | Thường thấy |
|---|---|---|---|
| 6 | 1 | 1/6 | 1–2 |
| 8 | 2 | 1/4 | 2 ✅ |
| 10 | 2 | 1/5 | 2–3 |
| 15 | 3 | 1/5 | 3–4 |

Mốc 10 và 15 hơi thiên về phe Dân. Chưa phải lỗi — chỉ nên chơi thử vài ván rồi chỉnh. Ghi lại ở đây để không quên. Việc này sẽ tự đặt lại khi thêm các vai đặc biệt, vì vai đặc biệt làm phe Dân mạnh lên đáng kể.

---

### Thứ tự đề xuất

1. **§8.2** nguyên nhân chết — nền móng, không có nó thì không làm được §8.1 lẫn các vai đặc biệt
2. **§8.1** nhật ký sự kiện — thứ khiến game thực sự chơi được
3. **§8.3** người bỏ ngang — chắc chắn gặp ngay lần chơi thử đầu tiên
4. **§8.6** chốt các luật bỏ phiếu còn bỏ ngỏ — rẻ, chỉ cần quyết định
5. **§8.4** chặn ván chạy vô hạn
6. **§8.5** kết thúc ván sớm
7. **§8.7** tổng kết và lịch sử ván
8. **§8.8** cân bằng lại tỉ lệ sau khi chơi thử

Ba mục đầu là phần khiến ván chơi hiện tại "chạy được nhưng chưa chơi được". Từ mục 4 trở đi là hoàn thiện.

---

## 9. Nợ kỹ thuật — ván đứng vĩnh viễn khi restart server

**Trạng thái:** đã biết, chấp nhận, chưa xử lý (chốt ngày 2026-09-07).

### Nguyên nhân

Lịch chuyển pha nằm hoàn toàn trong RAM: `GameService.schedulePhase()` tạo một `setTimeout` và gửi vào `SchedulerRegistry` của `@nestjs/schedule`. Cột `games.phaseEndsAt` chỉ để client đếm ngược, **không có gì đọc lại nó lúc khởi động** để lên lịch lại.

Nên khi process chết (deploy, crash, hoặc `pnpm run start:dev` tự restart mỗi lần sửa file), mọi ván đang `IN_PROGRESS` mất timer và không bao giờ chuyển pha nữa.

### Hệ quả dây chuyền — người chơi bị nhốt trong phòng

Đây mới là phần đau, không chỉ là "ván dừng":

```
ván đứng → games.status kẹt IN_PROGRESS → rooms.status kẹt PLAYING
                                              ↓
        leaveRoom()   cấm rời phòng khi PLAYING        → không thoát ra được
        joinRoom()    chặn user đang ở phòng khác      → không vào phòng khác được
        createRoom()  chặn user đang ở phòng khác      → không tạo phòng mới được
```

Người chơi **không phải chủ phòng bị kẹt vĩnh viễn**. Lối thoát duy nhất là chủ phòng gọi `DELETE /rooms/:id` (`removeRoom` không quan tâm `status`), hoặc vào DB sửa tay.

### Cách xử lý khi nào cần

| Phương án | Mô tả | Chi phí |
|---|---|---|
| **Huỷ ván dở dang lúc khởi động** | `onModuleInit` tìm ván `IN_PROGRESS`, đánh `CANCELLED`, emit `game.finished` để phòng về `WAITING`. Không khôi phục ván, chỉ gỡ kẹt cho người chơi | ~10 dòng, chạy 1 lần lúc boot |
| **Khôi phục ván** | Lúc khởi động đọc `phaseEndsAt` của các ván `IN_PROGRESS` rồi `schedulePhase()` lại phần thời gian còn lại; quá hạn thì xử lý ngay | ~20 dòng |
| **Quét DB định kỳ** | `@Interval` quét ván có `phaseEndsAt` quá hạn. Bền nhất, nhưng đã bị loại vì làm các ván bị đồng bộ vào cùng lưới thời gian | — |
| **BullMQ delayed jobs** | Lịch nằm ngoài process, sống sót restart và chạy được nhiều instance | Thêm Redis |

Phương án 1 rẻ nhất và gỡ được phần nghiêm trọng nhất (người chơi bị nhốt). Phương án 2 là bản đầy đủ khi cần chơi thật.

### Ghi chú liên quan

- Cả 2 chốt chặn chống chuyển pha trùng (`cancelPhase` trước khi hẹn giờ mới, và check `status !== IN_PROGRESS` đầu `advanceGame`) chỉ an toàn **trong một process**. Chạy nhiều instance sẽ cần khoá ở tầng DB.
- `@nestjs/schedule` ghim ở **6.1.3** — bản 12.x là ESM-only, `require()` được từ CommonJS nhờ Node ≥22.12 nhưng làm Jest (CommonJS) không load nổi. 6.1.3 là bản CJS cuối cùng còn hỗ trợ `@nestjs/common ^11`. Nếu nâng lên 12.x thì phải chuyển Jest sang ESM.
