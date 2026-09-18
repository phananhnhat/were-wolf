# Clean Architecture cho dự án Werewolf API

Tài liệu giải thích mô hình Clean Architecture của dự án.

---

## 1. Có bao nhiêu layer

Clean Architecture (Robert C. Martin) gồm **4 vòng tròn đồng tâm**, xếp từ trong ra ngoài:

```
        ┌─────────────────────────────────────────────────────────┐
        │  Layer 4 — Frameworks & Drivers        (NGOÀI CÙNG)      │
        │  NestJS, TypeORM, PostgreSQL, Express, @nestjs/schedule  │
        │  ┌───────────────────────────────────────────────────┐  │
        │  │  Layer 3 — Interface Adapters                      │  │
        │  │  Controller, DTO, TypeORM adapter, Exception filter│  │
        │  │  ┌─────────────────────────────────────────────┐  │  │
        │  │  │  Layer 2 — Application (Use Cases)           │  │  │
        │  │  │  Điều phối: transaction, gọi domain, gọi repo│  │  │
        │  │  │  ┌───────────────────────────────────────┐  │  │  │
        │  │  │  │  Layer 1 — Domain (Entities)  TRONG CÙNG│  │  │  │
        │  │  │  │  Game, GamePlayer, luật thắng thua,    │  │  │  │
        │  │  │  │  luật kỹ năng — KHÔNG biết NestJS/DB   │  │  │  │
        │  │  │  └───────────────────────────────────────┘  │  │  │
        │  │  └─────────────────────────────────────────────┘  │  │
        │  └───────────────────────────────────────────────────┘  │
        └─────────────────────────────────────────────────────────┘
```

| # | Layer | Vị trí | Vai trò |
|---|---|---|---|
| 1 | **Domain** (Entities) | **Trong cùng** | Luật nghiệp vụ thuần tuý: điều kiện thắng, ai được vote ai, luật riêng từng vai. Không import bất kỳ thứ gì từ `@nestjs/*` hay `typeorm`. |
| 2 | **Application** (Use Cases) | Bọc quanh Domain | Điều phối một hành động cụ thể của người dùng (vd. "Sói bỏ phiếu cắn"): gọi repository lấy dữ liệu, gọi Domain để áp luật, gọi repository lưu lại, mở transaction. |
| 3 | **Interface Adapters** | Bọc quanh Application | "Phiên dịch" giữa thế giới ngoài (HTTP, DB) và Application: Controller nhận HTTP request → gọi use case; TypeORM adapter implement các repository interface mà Domain định nghĩa. |
| 4 | **Frameworks & Drivers** | **Ngoài cùng** | Công cụ cụ thể: NestJS (routing, DI), TypeORM (ORM), PostgreSQL, `main.ts`, `*.module.ts`. Dễ thay nhất — đổi ORM hay đổi framework chỉ ảnh hưởng vòng này. |

## 2. Quy tắc phụ thuộc (Dependency Rule) — điều quan trọng nhất

> **Mã nguồn chỉ được phụ thuộc vào trong, không bao giờ phụ thuộc ra ngoài.**

- Layer 1 (Domain) không biết Layer 2, 3, 4 tồn tại. Nó là TypeScript thuần, tự đứng một mình,
  compile được mà không cần cài NestJS hay TypeORM.
- Layer 2 (Application) được phép gọi Layer 1, nhưng chỉ biết Layer 3 qua **interface** (vd.
  `GameRepository`), không biết TypeORM là thứ hiện thực hoá interface đó.
- Layer 3, 4 được phép biết tất cả các layer trong hơn nó.

Nhờ quy tắc này: đổi PostgreSQL sang MySQL, hay đổi NestJS sang Express thuần, chỉ cần viết lại
Layer 3/4 — **không đụng một dòng nào ở Layer 1, 2**, vì luật chơi Ma Sói không liên quan gì đến
việc dữ liệu được lưu ở đâu.

## 3. Thư mục nào ứng với layer nào (GameModule)

| Thư mục / file | Layer | Trạng thái |
|---|---|---|
| `src/game/domain/entities/*.entity.ts` (`Game`, `GamePlayer`, `GameVote`, `GameAction`) | 1 — Domain | ✅ Đã tạo |
| `src/game/domain/value-objects/*.vo.ts` (`GameId`, `PlayerId`, `Role`) | 1 — Domain | ✅ Đã tạo |
| `src/game/domain/enums/*.enum.ts` | 1 — Domain | ✅ Đã tạo |
| `src/game/domain/services/*.service.ts` (`WinConditionService`, `NightResolutionService`, `GameRulesService`, ...) | 1 — Domain | ✅ Đã tạo |
| `src/game/domain/errors/*.error.ts` | 1 — Domain | ✅ Đã tạo |
| `src/game/domain/repositories/*.repository.ts` — interface (port) + token `Symbol` cạnh mỗi interface, Domain định nghĩa "tôi cần gì" nhưng không tự làm | 1 — Domain (phần khai báo hợp đồng) | ✅ Đã tạo |
| `src/game/application/ports/*.ts` (`GameUnitOfWork`, `GamePhaseScheduler`, `GameEventPublisher`, `Logger`) | 2 — Application (khai báo hợp đồng) | ✅ Đã tạo |
| `src/game/application/use-cases/*.use-case.ts` (15 file, vd. `cast-wolf-vote.use-case.ts`) — thay hoàn toàn nội dung cũ của `GameService` | 2 — Application | ✅ Đã tạo và **đã nối dây thật**. Mỗi use case là **HÀM** (`export async function seerCheck(...)`), KHÔNG phải class — nhận repository/port cần dùng làm tham số đầu, gọi Domain layer để áp luật, không tự "biết" DI. `castWolfVote`/`castLynchVote` gọi thẳng `getVoteTally(...)` (import hàm, gọi bình thường) thay vì phải nhờ NestJS "tiêm" một use case khác vào. |
| `src/game/infrastructure/persistence/typeorm-*.repository.ts` (4 file) — hiện thực hoá 4 repository interface ở `domain/repositories/` bằng `Repository<T>` của TypeORM, tự map domain ↔ ORM entity | 3 — Interface Adapters (Gateway) | ✅ Đã tạo. Mỗi class là `@Injectable()` + `@InjectRepository(XxxOrmEntity)` trên tham số constructor — giống hệt cách 4 port Gateway bên dưới đã làm, nên `game.module.ts` chỉ cần `{ provide: TOKEN, useClass: ... }` cho cả 8, không cần `useFactory`/`getRepositoryToken()` thủ công nữa. |
| `src/game/infrastructure/typeorm-game-unit-of-work.ts`, `game-phase-scheduler.adapter.ts`, `game-event-publisher.adapter.ts`, `logger.adapter.ts` — hiện thực hoá 4 port ở `application/ports/` | 3 — Interface Adapters (Gateway) | ✅ Đã tạo |
| `src/game/infrastructure/game-domain-exception.filter.ts` — dịch `GameDomainError.code` → đúng `HttpException` | 3 — Interface Adapters | ✅ Đã tạo, gắn vào `GameController` qua `@UseFilters(...)` |
| `src/game/game.controller.ts` + `src/game/dto/*.dto.ts` | 3 — Interface Adapters | ✅ Không đổi cách gọi `GameService`, chỉ thêm `@UseFilters(GameDomainExceptionFilter)` |
| `src/game/infrastructure/persistence/*.orm-entity.ts` (4 file) — các class có decorator `@Entity()`, đổi tên + dọn từ `src/game/entities/` sang đây | 4 — Frameworks & Drivers | ✅ Đã đổi tên + di chuyển — xem lưu ý bên dưới |
| `src/game/game.service.ts` | **3 — Interface Adapters (Facade, cố ý giữ lại)** | ✅ Viết lại — chỉ `@Inject` **8 adapter thô** (4 repository + 4 port) qua token, mỗi method gọi thẳng hàm use case tương ứng, tự truyền các adapter đó làm tham số. Không còn tự chứa luật/DB/transaction/hẹn giờ/sự kiện. Controller vẫn gọi vào đây, KHÔNG gọi thẳng use case — lựa chọn có chủ đích của dự án, không phải sai sót. |
| `src/game/game.module.ts` | 4 — Frameworks & Drivers (composition root) | ✅ Viết lại — chỉ còn **8 provider**, mỗi dòng `{ provide: TOKEN, useClass: XxxAdapter }` (bind interface Domain/Application → implementation Infrastructure qua token). Use case KHÔNG cần đăng ký provider riêng nữa vì là hàm thuần, không phải class NestJS phải khởi tạo. |
| `src/app.module.ts`, `src/main.ts` | 4 — Frameworks & Drivers | Không đổi |

### Lưu ý: 2 khái niệm "entity" khác hẳn nhau, giờ đã tách tên rõ ràng

- `src/game/**domain**/entities/game.entity.ts` → class TypeScript thuần, có hành vi
  (`game.assertInProgress()`, `game.finish(winner)`), **đây là Layer 1**. Giữ đuôi `.entity.ts`.
- `src/game/infrastructure/persistence/game.**orm**-entity.ts` (trước đây ở
  `src/game/entities/game.entity.ts`) → class có decorator `@Entity()`, `@Column()` của
  TypeORM, chỉ là **bản đồ ánh xạ tới bảng Postgres**, không có hành vi gì — chi tiết kỹ thuật
  của Layer 4. Đã đổi đuôi thành `.orm-entity.ts` và dọn sang `infrastructure/persistence/`
  đúng như định hướng ghi trước đó, để tên file tự nói lên sự khác biệt thay vì phải nhớ.
  `RoomsModule` (đọc `Game`/`GameStatus` trong `reconcileStuckRooms()`) và `AppModule`
  (`TypeOrmModule.forRootAsync`'s `entities: [...]`) cũng trỏ sang đường dẫn mới này.

## 4. Ví dụ minh hoạ: "Sói bỏ phiếu cắn" đi qua các layer thế nào

Đây là luồng **THẬT đang chạy** (đã kiểm chứng bằng cách boot app thật + gọi API thật qua
Postgres — xem mục 6):

```
[Layer 3] GameController.castWolfVote()
    → gọi [Layer 3] GameService.castWolfVote()   // Facade, giữ nguyên chữ ký cũ cho controller
        → gọi [Layer 2] castWolfVote(this.games, this.players, this.votes, gameId, voterId, targetId)
          // HÀM thuần, không phải use case instance — GameService tự truyền 3 adapter đã inject

[Layer 2] castWolfVote(games, players, votes, ...)
    → games.findById(gameId)                 // qua INTERFACE, không biết TypeORM
    → players.findByGameAndUser(...)
    → [Layer 1] GameRulesService.assertCanVote(game, voter, target, NIGHT)   ← luật nằm ở đây
    → [Layer 1] GameRulesService.assertWolfVoteRules(voter, target)         ← luật nằm ở đây
    → votes.save(GameVote.cast(...))          // qua INTERFACE
    → return getVoteTally(games, players, votes, ...)   // gọi thẳng 1 hàm khác, không qua DI

[Layer 3] TypeOrmGameRepository / TypeOrmGameVoteRepository implements ...Repository
    → thật sự chạy this.repo.findOneBy(...)/this.repo.save(...) của TypeORM

[Layer 4] TypeORM + PostgreSQL
    → SELECT/INSERT thật vào bảng games/game_votes

Nếu có lỗi (vd. ván không tồn tại): [Layer 1] ném GameNotFoundError (plain Error, không biết
HTTP) → [Layer 3] GameDomainExceptionFilter bắt được (@UseFilters trên GameController) → dịch
thành NotFoundException → response HTTP 404 y hệt trước khi tách layer.
```

**Vì sao `castWolfVote` gọi thẳng `getVoteTally` bằng lời gọi hàm bình thường, không qua DI**:
use case không còn là class NestJS quản lý vòng đời, nên "dùng lại 1 use case khác" chỉ đơn
giản là import hàm rồi gọi — không cần khai token, không cần đăng ký provider. Đây cũng là lý do
`GamePhaseSchedulerAdapter` (Infrastructure) hết cần `ModuleRef`/`OnModuleInit`: nó tự gọi
`advanceGame(this.unitOfWork, this, this.eventPublisher, gameId)` trực tiếp trong callback của
`setTimeout` — vòng lặp phụ thuộc "scheduler cần use case, use case cần scheduler" từng phải xử
lý bằng cách lấy lười qua `ModuleRef` không còn tồn tại nữa, vì `this` (adapter tự implement
`GamePhaseScheduler`) dùng được ngay, không cần NestJS "tiêm" gì thêm.

Khác biệt cốt lõi: **luật "chỉ Sói được vote, không cắn đồng đội" nằm đúng một chỗ**
(`GameRulesService`, Layer 1), test được bằng cách gọi thẳng hàm đó với dữ liệu giả — không cần
khởi động NestJS, không cần Postgres.

## 5. Việc còn lại (chưa làm)

1. Chưa có unit test tự động cho Domain/Application layer ở bất kỳ module nào — tất cả đều là
   TypeScript thuần nên rất dễ viết test không cần DB/NestJS, nhưng chưa làm.
2. `src/{users,auth,rooms}/entities/*.entity.ts` (TypeORM cũ của 3 module này) chưa đổi tên
   thành `*.orm-entity.ts`/chưa dọn sang `infrastructure/persistence/` — cố ý để lại, giống
   GameModule ở lượt đầu (xem mục 7), tránh blast radius quá lớn (các file này bị nhiều module
   khác tham chiếu: `User` bị `GamePlayer`/`GameVote`/`GameAction`/`RoomMember` import).

~~Nợ kỹ thuật: đổi tên/dọn `src/game/entities/*.entity.ts` sang
`src/game/infrastructure/persistence/*.orm-entity.ts`~~ — **đã xử lý**, xem mục 6.

~~Lặp lại pattern Clean Architecture cho `UsersModule`, `AuthModule`, `RoomsModule`~~ — **đã
xong**, xem mục 7.

## 6. Đã kiểm chứng thế nào

Khác 2 bước trước (chỉ cộng file mới, chưa ai gọi tới), bước nối dây Interface Adapters đã được
kiểm chứng bằng cách chạy thật: `docker compose up -d postgres` rồi `pnpm run start:dev` — app
boot sạch, `GameModule dependencies initialized` không lỗi (đây là phần rủi ro chính: token DI
sai hoặc vòng lặp phụ thuộc chưa xử lý đúng sẽ lộ ra ngay ở bước này). Sau đó gọi thật qua HTTP:
đăng ký, đăng nhập, tạo phòng, và gọi endpoint ván chơi với id không tồn tại để xác nhận
`GameDomainExceptionFilter` trả đúng `404 { "message": "Không tìm thấy ván chơi" }` — y hệt
hành vi cũ.

Sau đó, khi chuyển 15 use case từ class sang hàm thuần (giảm `game.module.ts` từ 23 xuống còn
8 provider) và bỏ `ModuleRef`/`OnModuleInit` ở `GamePhaseSchedulerAdapter`, đã boot lại + gọi
API lại đúng quy trình trên để xác nhận không có gì hỏng theo — bao gồm cả đường gọi
`castWolfVote → getVoteTally` (2 hàm gọi trực tiếp nhau, không qua DI) trả đúng 404 qua
`GameDomainExceptionFilter` như trước khi đổi.

Sau đó nữa, dọn nợ kỹ thuật đổi tên/di chuyển 4 file entity ORM (`git mv` giữ lịch sử) sang
`src/game/infrastructure/persistence/*.orm-entity.ts`, sửa toàn bộ nơi import theo — **kể cả
2 file ngoài `GameModule`**: `src/app.module.ts` (danh sách `entities: [...]` của
`TypeOrmModule.forRootAsync`) và `src/rooms/rooms.module.ts`/`rooms.service.ts` (RoomsModule
đọc bảng `games` trong `reconcileStuckRooms()`). Tiện thể xoá luôn
`src/game/constants/timing.ts`/`factions.ts` — 2 file này hết người dùng từ khi `GameService`
được viết lại ở bước nối Application layer, chỉ còn được nhắc tới trong comment "TẠM THỜI trùng
lặp" của domain layer (nay cũng đã xoá comment đó). Xác nhận bằng `pnpm run build` sạch, sau đó
boot lại lần nữa qua Postgres và gọi cả 2 luồng (tạo phòng — qua `RoomsModule`'s `Game` repo, và
endpoint ván chơi lỗi — qua `GameModule`) để chắc cả 2 module dùng entity đã di chuyển đều chạy
đúng.

Sau đó nữa, đổi 4 repository Gateway (`typeorm-*.repository.ts`) từ đăng ký qua `useFactory` +
`getRepositoryToken()` thủ công sang `@Injectable()` + `@InjectRepository(...)` trên tham số
constructor — cho đồng bộ với cách 4 port Gateway đã làm, và để `game.module.ts` chỉ còn toàn
`useClass` một dòng cho cả 8 provider. `TypeOrmGameUnitOfWork.runInTransaction()` vẫn tự `new
TypeOrmGameRepository(manager.getRepository(...))` bình thường bên trong transaction — decorator
trên constructor chỉ ảnh hưởng lúc NestJS tự khởi tạo qua DI, không ảnh hưởng lúc gọi `new` tay.
Xác nhận lại bằng build + boot + gọi API y hệt quy trình trên.

## 7. UsersModule, AuthModule, RoomsModule

Áp dụng đúng pattern đã chốt ở `GameModule` (mục 1-6) cho 3 module còn lại, làm cả 3 trong 1
lượt (không tách nhỏ theo từng bước như GameModule — 3 module này nhỏ hơn nhiều). Cấu trúc thư
mục giống hệt: `domain/{value-objects,entities,enums,errors,repositories,services}` →
`application/{use-cases,ports}` (hàm thuần, không phải class) → `infrastructure/persistence` +
`infrastructure/*.adapter.ts` + `*-domain-exception.filter.ts` → Facade (`*.service.ts`, giữ
nguyên chữ ký public) + Controller (chỉ thêm `@UseFilters(...)`) + `*.module.ts`.

**Quyết định thiết kế đáng chú ý (khác GameModule, riêng cho lượt này):**

- **`AuthenticatedUser`** (`auth/decorators/current-user.decorator.ts`) thay cho việc
  `@CurrentUser()` từng trả thẳng ORM `User` entity — nay chỉ `{id, username}`. Lý do: nếu để
  `@CurrentUser()` trả `User` (Domain entity của UsersModule), mọi controller khác
  (`RoomsController`, `GameController`) vô tình phải biết Domain entity của module khác chỉ để
  đọc `req.user`. Tách riêng 1 type nhẹ, không thuộc module nào, giải quyết dứt điểm.
- **Facade-là-Presenter**: `UsersService`/`RoomsService` không trả thẳng Domain entity qua HTTP
  mà map sang DTO thuần (`UserResponseDto`, `RoomResponseDto`, `RoomDetailResponseDto`) — vì (1)
  Value Object serialize JSON sai dạng (`RoomCode` sẽ ra `{value:"ABCD"}` thay vì `"ABCD"` nếu
  trả thẳng), và (2) Domain entity mang field nhạy cảm không có `@Exclude()` bảo vệ
  (`User.passwordHash`). Điểm tinh tế: `RoomMemberResponseDto` giữ lại `id` (PK riêng của dòng
  `room_members`, không phải PK của `User`) — vì response gốc trả field này, nên đọc qua 1
  read-model riêng `RoomMemberWithUser` (không phải Domain entity `RoomMember` thuần) để không
  mất field đó.
- **`GameStatusReader` — port hẹp do bên dùng (Rooms) tự định nghĩa**, không tái dùng
  `GameRepository` interface đầy đủ của GameModule. Chỉ 1 method:
  `hasActiveGame(roomId): Promise<boolean>`. Cách này tránh việc GameModule phải export token ra
  ngoài chỉ để phục vụ 1 câu hỏi rất hẹp, và tránh tạo phụ thuộc module thật giữa 2 module vốn
  chỉ nên nói chuyện qua event (`room.started`/`game.finished`/`game.start_failed`).
  Implementation (`typeorm-game-status-reader.ts`) nằm trong `rooms/infrastructure/`, tự
  `@InjectRepository` thẳng vào ORM entity của GameModule — chỉ Infrastructure layer của Rooms
  mới biết GameModule tồn tại, Domain/Application của Rooms thì không.
- **`UserDirectory` — port hẹp do bên dùng (Auth) tự định nghĩa** (sửa lại sau khi phát hiện vi
  phạm Dependency Rule — xem "Sửa lại" bên dưới): ban đầu `AuthModule` cho Domain/Application/
  Facade/2 Strategy của chính nó import thẳng `UserRepository` (port) + `User` (entity) +
  `UserId` (VO) từ `users/domain/*` — tái dùng Application layer của module khác, giống lỗi mà
  `GameStatusReader` đã tránh được cho Rooms↔Game. Sửa lại theo đúng pattern đó: `AuthModule` tự
  định nghĩa port riêng `UserDirectory` (`auth/application/ports/user-directory.ts` — chỉ có
  `findByUsername/findByEmail/findById/create/updatePasswordHash`, làm việc với
  `AuthUserRecord {id, username, passwordHash}` — kiểu dữ liệu của riêng AuthModule, không phải
  `User` domain entity của UsersModule). **Chỉ 1 file** trong toàn AuthModule được phép biết
  UsersModule tồn tại: `auth/infrastructure/user-directory.adapter.ts`
  (`TypeOrmUserDirectory implements UserDirectory`), tự `@Inject(USER_REPOSITORY)` port của
  UsersModule bên trong, dịch qua lại `User` ↔ `AuthUserRecord`. Nhờ vậy không có 2 cài đặt
  TypeORM độc lập cùng ghi bảng `users` (khác GameStatusReader — nó chỉ đọc, không ghi, nên tự
  `@InjectRepository` thẳng cũng an toàn; ở đây Auth cần ghi — tạo user mới lúc đăng ký, đổi
  passwordHash lúc đổi mật khẩu — nên phải đi qua `UserRepository` sẵn có của UsersModule để
  chỉ có 1 nguồn sự thật). Tác dụng phụ tốt: `changeUserPassword` giờ ném lỗi CỦA AuthModule
  (`AuthUserNotFoundError`) thay vì `UserNotFoundError` của UsersModule, nên `AuthController` bỏ
  được `UserDomainExceptionFilter` thứ 2, chỉ còn `AuthDomainExceptionFilter`.
  `UsersModule.exports` vẫn giữ `USER_REPOSITORY` bên cạnh `UsersService` — nhưng giờ chỉ có 1
  nơi duy nhất (`user-directory.adapter.ts`) import nó, thay vì rải rác 6 file.
