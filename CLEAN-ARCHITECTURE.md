# Clean Architecture cho dự án Werewolf API

Tài liệu giải thích mô hình Clean Architecture đang được áp dụng dần vào dự án, bắt đầu từ
`GameModule`. Xem code đã tạo ở `src/game/domain/`.

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
| `src/game/application/use-cases/*.use-case.ts` (15 file, vd. `cast-wolf-vote.use-case.ts`) — thay hoàn toàn nội dung cũ của `GameService` | 2 — Application | ✅ Đã tạo và **đã nối dây thật** (không còn là code chết) |
| `src/game/infrastructure/persistence/typeorm-*.repository.ts` (4 file) — hiện thực hoá 4 repository interface ở `domain/repositories/` bằng `Repository<T>` của TypeORM, tự map domain ↔ ORM entity | 3 — Interface Adapters (Gateway) | ✅ Đã tạo |
| `src/game/infrastructure/typeorm-game-unit-of-work.ts`, `game-phase-scheduler.adapter.ts`, `game-event-publisher.adapter.ts`, `logger.adapter.ts` — hiện thực hoá 4 port ở `application/ports/` | 3 — Interface Adapters (Gateway) | ✅ Đã tạo |
| `src/game/infrastructure/game-domain-exception.filter.ts` — dịch `GameDomainError.code` → đúng `HttpException` | 3 — Interface Adapters | ✅ Đã tạo, gắn vào `GameController` qua `@UseFilters(...)` |
| `src/game/game.controller.ts` + `src/game/dto/*.dto.ts` | 3 — Interface Adapters | ✅ Không đổi cách gọi `GameService`, chỉ thêm `@UseFilters(GameDomainExceptionFilter)` |
| `src/game/entities/*.entity.ts` — **các class có decorator `@Entity()` hiện tại** | 4 — Frameworks & Drivers | ⚠️ Vẫn ở vị trí cũ (nợ kỹ thuật — xem mục 5) — xem lưu ý bên dưới |
| `src/game/game.service.ts` | **3 — Interface Adapters (Facade, cố ý giữ lại)** | ✅ Viết lại — mỗi method chỉ delegate 1 dòng xuống use case tương ứng qua token (`@Inject`), không còn tự chứa luật/DB/transaction/hẹn giờ/sự kiện. Controller vẫn gọi vào đây, KHÔNG gọi thẳng use case — lựa chọn có chủ đích của dự án, không phải sai sót. |
| `src/game/game.module.ts` | 4 — Frameworks & Drivers (composition root) | ✅ Viết lại — nơi DUY NHẤT bind interface (Domain/Application) vào implementation (Infrastructure) qua token, "biết" cả 4 layer cùng lúc |
| `src/app.module.ts`, `src/main.ts` | 4 — Frameworks & Drivers | Không đổi |

### Lưu ý dễ nhầm: `src/game/entities/` KHÔNG phải Domain layer

Tên trùng nhau ("entity") nhưng ý nghĩa khác hẳn:

- `src/game/**domain**/entities/game.entity.ts` → class TypeScript thuần, có hành vi
  (`game.assertInProgress()`, `game.finish(winner)`), **đây là Layer 1**.
- `src/game/entities/game.entity.ts` (file cũ, có sẵn từ trước) → class có decorator
  `@Entity()`, `@Column()` của TypeORM, chỉ là **bản đồ ánh xạ tới bảng Postgres**, không có
  hành vi gì. Đây thực chất là chi tiết kỹ thuật của Layer 4, dù tên gọi theo thói quen NestJS
  là "entity". Ở bước làm Infrastructure layer sau này, file này nên được đổi tên thành
  `*.orm-entity.ts` và chuyển vào `src/game/infrastructure/persistence/` để tránh nhầm với
  Domain entity.

## 4. Ví dụ minh hoạ: "Sói bỏ phiếu cắn" đi qua các layer thế nào

Đây là luồng **THẬT đang chạy** (đã kiểm chứng bằng cách boot app thật + gọi API thật qua
Postgres — xem mục 6):

```
[Layer 3] GameController.castWolfVote()
    → gọi [Layer 3] GameService.castWolfVote()   // Facade, giữ nguyên chữ ký cũ cho controller
        → gọi [Layer 2] CastWolfVoteUseCase.execute(gameId, voterId, targetId)

[Layer 2] CastWolfVoteUseCase.execute(...)
    → gameRepo.findById(gameId)              // qua INTERFACE, không biết TypeORM
    → playerRepo.findByGameAndUser(...)
    → [Layer 1] GameRulesService.assertCanVote(game, voter, target, NIGHT)   ← luật nằm ở đây
    → [Layer 1] GameRulesService.assertWolfVoteRules(voter, target)         ← luật nằm ở đây
    → voteRepo.save(GameVote.cast(...))       // qua INTERFACE
    → trả kết quả qua GetVoteTallyUseCase (một use case khác, dùng lại)

[Layer 3] TypeOrmGameRepository / TypeOrmGameVoteRepository implements ...Repository
    → thật sự chạy this.repo.findOneBy(...)/this.repo.save(...) của TypeORM

[Layer 4] TypeORM + PostgreSQL
    → SELECT/INSERT thật vào bảng games/game_votes

Nếu có lỗi (vd. ván không tồn tại): [Layer 1] ném GameNotFoundError (plain Error, không biết
HTTP) → [Layer 3] GameDomainExceptionFilter bắt được (@UseFilters trên GameController) → dịch
thành NotFoundException → response HTTP 404 y hệt trước khi tách layer.
```

Khác biệt cốt lõi: **luật "chỉ Sói được vote, không cắn đồng đội" nằm đúng một chỗ**
(`GameRulesService`, Layer 1), test được bằng cách gọi thẳng hàm đó với dữ liệu giả — không cần
khởi động NestJS, không cần Postgres.

## 5. Việc còn lại (chưa làm)

1. Lặp lại đúng pattern này (Domain → Application → Interface Adapters) cho `UsersModule`,
   `AuthModule`, `RoomsModule`.
2. **Nợ kỹ thuật**: `src/game/entities/*.entity.ts` (TypeORM cũ) chưa đổi tên thành
   `*.orm-entity.ts` và chưa dọn sang `src/game/infrastructure/persistence/` — các adapter mới
   (mục 3) chỉ đang import chúng nguyên vị trí cũ. Không ảnh hưởng gì tới việc chạy đúng, chỉ là
   tên gọi "entity" hiện dùng cho 2 khái niệm khác nhau (xem lưu ý ở mục 3) chưa được dọn cho
   rõ ràng hoàn toàn.
3. Chưa có unit test tự động cho Domain/Application layer — cả 2 đều là TypeScript thuần nên
   rất dễ viết test không cần DB/NestJS, nhưng chưa làm ở bước nào trong 3 bước vừa qua.

## 6. Đã kiểm chứng thế nào

Khác 2 bước trước (chỉ cộng file mới, chưa ai gọi tới), bước nối dây Interface Adapters đã được
kiểm chứng bằng cách chạy thật: `docker compose up -d postgres` rồi `pnpm run start:dev` — app
boot sạch, `GameModule dependencies initialized` không lỗi (đây là phần rủi ro chính: token DI
sai hoặc vòng lặp phụ thuộc chưa xử lý đúng sẽ lộ ra ngay ở bước này). Sau đó gọi thật qua HTTP:
đăng ký, đăng nhập, tạo phòng, và gọi endpoint ván chơi với id không tồn tại để xác nhận
`GameDomainExceptionFilter` trả đúng `404 { "message": "Không tìm thấy ván chơi" }` — y hệt
hành vi cũ.
