# Thiết kế Vòng lượt chơi (Round Loop)

Sau khi ván bắt đầu, hệ thống tự chạy các lượt chơi. Mỗi lượt gồm **2 pha, mỗi pha 60 giây**. Hết mỗi pha thì kiểm phiếu, người bị vote nhiều nhất bị đánh dấu đã chết.

**Trạng thái: đã thực thi (2026-09-07).** Tham chiếu: [game.md](./game.md) (khởi tạo ván), [game-rules.md](./game-rules.md) (luật), [room.md](./room.md) (lobby).

Các quyết định đã chốt:

| | Chốt |
|---|---|
| Hoà phiếu | **Không ai chết** — `pickUniqueMaxTarget` trả `null` khi hoà hoặc không ai vote |
| Bỏ `DAY_VOTE` khỏi enum | Xoá luôn, DB chưa có dữ liệu nên không cần dọn |
| Huỷ ván dở dang lúc khởi động | **Không làm** — ghi thành nợ kỹ thuật ở [PLAN.md §9](../PLAN.md) |
| Cơ chế hẹn giờ | Hẹn giờ **từng ván** bằng `SchedulerRegistry`, không quét DB định kỳ |

Phạm vi giai đoạn này: **chỉ 2 vai — Sói và Dân làng**. Các vai đặc biệt (Tiên tri, Bảo vệ, Phù thuỷ, Thợ săn, Người điên) để nâng cấp sau.

---

## 1. Mô hình lượt chơi

Một **lượt** = 2 pha, tổng **120 giây**:

```
                    ┌───────── LƯỢT N (120s) ─────────┐
                    │                                  │
   ván bắt đầu ───► │    NIGHT    →     DAY            │ ──► LƯỢT N+1
                    │     60s            60s           │
                    │  Sói vote      cả làng vote      │
                    │       │              │           │
                    └───────┼──────────────┼───────────┘
                            ▼              ▼
                    kiểm phiếu Sói   kiểm phiếu làng
                    → giết 1 người   → giết 1 người
                    → check thắng    → check thắng
                                     → dayNumber + 1
```

| Pha | Thời lượng | Ai được bỏ phiếu | Ai xem được kiểm phiếu | Khi pha đóng |
|---|---|---|---|---|
| `NIGHT` | 60s | Sói còn sống | Sói | Kiểm phiếu → giết → check thắng → `DAY` |
| `DAY` | 60s | Mọi người còn sống | Mọi người trong ván | Kiểm phiếu → treo cổ → check thắng → `NIGHT`, lượt +1 |

**Ván luôn bắt đầu ở `NIGHT`.**

Không còn pha "thảo luận" riêng — việc trao đổi diễn ra ngay trong 60s của pha tương ứng. Dù sao hệ thống cũng chưa có chat.

> **Lưu ý nhãn đêm/ngày:** thiết kế theo luật Ma Sói chuẩn — **đêm** Sói cắn, **ngày** cả làng treo cổ. Muốn đảo ngược thì chỉ là đổi tên 2 giá trị enum, logic không đổi.

---

## 2. Thay đổi so với code hiện tại

| | Hiện tại | Sau thay đổi |
|---|---|---|
| Số pha | 3: `NIGHT` → `DAY` → `DAY_VOTE` | 2: `NIGHT` → `DAY` |
| Thời lượng | 2p / 5p / 1p = 8 phút/lượt | 60s / 60s = 2 phút/lượt |
| `DAY` | Thảo luận, **không** được vote | **Được vote** (thay vai trò của `DAY_VOTE` cũ) |
| Vai trò | 7 vai (`werewolf`…`fool`) | **2 vai**: `werewolf`, `villager` |
| Hẹn giờ | `setTimeout` + `Map` tự quản lý | `@nestjs/schedule` `SchedulerRegistry` — vẫn hẹn giờ **từng ván** |
| Hàm chuyển pha | 3 hàm nối nhau | 1 hàm `advanceGame()` |

**Giữ nguyên:** chia vai lúc `room.started`, `pickUniqueMaxTarget`, điều kiện thắng Sói/Dân, cách giấu vai trò, huỷ ván khi phòng bị xoá, cột `dayNumber`.

**Không đổi (đã chốt):** ván vẫn đứng vĩnh viễn khi restart server — nợ kỹ thuật, xem [PLAN.md §9](../PLAN.md).

---

## 3. Vai trò — rút còn 2

### 3.1. `room-configs.ts`

```ts
export const ROLE_CONFIG_BY_MAX_PLAYERS: Record<MaxPlayers, Record<string, number>> = {
  6:  { werewolf: 1, villager: 5 },
  8:  { werewolf: 2, villager: 6 },
  10: { werewolf: 2, villager: 8 },
  15: { werewolf: 3, villager: 12 },
};
```

Số Sói giữ **đúng như cấu hình hiện tại**; toàn bộ vai đặc biệt chuyển thành `villager`. Khi nâng cấp sau này chỉ cần sửa lại bảng này — `buildShuffledRoles()` không phải đụng vào.

### 3.2. `factions.ts`

```ts
export const WEREWOLF_ROLES = ['werewolf'];
```

Xoá `THIRD_PARTY_ROLES` (chỉ chứa `fool`, giờ không còn vai này).

### 3.3. Hệ quả

- **Xoá nhánh Người điên** khi đóng pha `DAY`: không còn `if (lynched && THIRD_PARTY_ROLES.includes(...)) → THIRD_PARTY`.
- **Giữ `GameWinner.THIRD_PARTY` trong enum** dù tạm thời không dùng — để dành cho vai Người điên khi nâng cấp. Xoá rồi thêm lại một giá trị Postgres enum tốn công hơn là để đó.
- `checkWinCondition` không phải sửa: nó vốn chỉ chia 2 phe theo `WEREWOLF_ROLES`.
- `revealRoleIfAllowed` không phải sửa.

---

## 4. Mô hình dữ liệu

### 4.1. `GamePhase` — bỏ `DAY_VOTE`

```ts
export enum GamePhase {
  NIGHT = 'NIGHT',  // 60s — Sói chọn nạn nhân
  DAY = 'DAY',      // 60s — cả làng bỏ phiếu treo cổ
}
```

Cả `games.phase` và `game_votes.phase` dùng chung Postgres enum type này. DB lúc đổi chưa có dữ liệu nên `synchronize: true` tạo lại enum type không gặp trở ngại.

### 4.2. `timing.ts` — còn đúng 1 hằng số

```ts
// Cả 2 pha đều 60s
export const PHASE_DURATION_MS = 60_000;
```

Xoá `NIGHT_DURATION_MS`, `DAY_DISCUSSION_DURATION_MS`, `DAY_VOTE_DURATION_MS`.

### 4.3. `games`, `game_players`, `game_votes`

Không đổi cột nào, không thêm index. Unique `UNIQUE(gameId, phase, dayNumber, voterId)` giữ nguyên — `NIGHT` và `DAY` là 2 giá trị khác nhau nên phiếu đêm/ngày cùng lượt không đụng nhau.

Sửa comment trên `game-vote.entity.ts`: `phase` giờ nhận `NIGHT` hoặc `DAY`.

`phaseEndsAt` vẫn chỉ là **thông tin để client đếm ngược**, không phải nguồn sự thật để lên lịch — lịch nằm trong RAM.

---

## 5. Hẹn giờ từng ván bằng `SchedulerRegistry`

### 5.1. Cài đặt

```bash
pnpm add @nestjs/schedule
```

```ts
// app.module.ts
imports: [ ..., ScheduleModule.forRoot() ]
```

### 5.2. Thay `Map` thủ công bằng registry

`@nestjs/schedule` không chỉ có `@Interval`. `SchedulerRegistry` cho phép **hẹn giờ động cho từng ván**, đúng mô hình hiện tại — mỗi ván một timer riêng, chạy đúng thời điểm của nó, không đụng gì tới ván khác:

```ts
constructor(
  ...,
  private readonly schedulerRegistry: SchedulerRegistry,
) {}

private phaseTimerName(gameId: number): string {
  return `game-phase-${gameId}`;
}

private schedulePhase(gameId: number): void {
  this.cancelPhase(gameId);                       // đảm bảo mỗi ván chỉ có 1 timer
  const timeout = setTimeout(() => {
    this.cancelPhase(gameId);                     // dọn khỏi registry trước khi chạy
    this.advanceGame(gameId).catch((err) =>
      this.logger.error(`Lỗi chuyển pha game #${gameId}`, err?.stack),
    );
  }, PHASE_DURATION_MS);
  this.schedulerRegistry.addTimeout(this.phaseTimerName(gameId), timeout);
}

private cancelPhase(gameId: number): void {
  const name = this.phaseTimerName(gameId);
  if (this.schedulerRegistry.doesExist('timeout', name)) {
    this.schedulerRegistry.deleteTimeout(name);   // tự gọi clearTimeout bên trong
  }
}
```

**So với `phaseTimers = new Map()` hiện tại thì được gì:**

- Không phải tự quản lý Map — `deleteTimeout()` đã bao gồm `clearTimeout()`.
- Nest **tự dọn toàn bộ timer lúc app shutdown**, không còn handle treo làm process không thoát được.
- `schedulerRegistry.getTimeouts()` liệt kê được timer đang sống → debug "ván này còn được hẹn giờ không?" dễ hơn hẳn.

Vẫn là `setTimeout` bên dưới, nên **mỗi ván chạy theo nhịp riêng của nó**, không bị gom vào lưới thời gian chung.

### 5.3. `advanceGame` — một hàm thay cho ba

Vì 2 pha giờ làm việc gần giống hệt nhau (đều kiểm phiếu, đều giết, đều check thắng), 3 hàm hiện tại `resolveNightPhase` / `startDayVote` / `resolveDayPhase` gộp lại còn một:

```ts
private async advanceGame(gameId: number): Promise<void> {
  const game = await this.gamesRepo.findOneBy({ id: gameId });
  if (!game || game.status !== GameStatus.IN_PROGRESS) return;

  await this.resolveVoteKill(game);                // kiểm phiếu pha vừa đóng, giết người
  if (await this.checkWinCondition(game)) return;  // ván kết thúc → không mở pha mới

  if (game.phase === GamePhase.NIGHT) {
    game.phase = GamePhase.DAY;
  } else {
    game.phase = GamePhase.NIGHT;
    game.dayNumber += 1;
  }
  game.phaseEndsAt = new Date(Date.now() + PHASE_DURATION_MS);
  await this.gamesRepo.save(game);

  this.schedulePhase(game.id);
}
```

Phần kiểm phiếu + giết, trước đây **bị chép đôi** ở 2 hàm resolve, tách ra dùng chung:

```ts
private async resolveVoteKill(game: Game): Promise<GamePlayer | null> {
  const votes = await this.votesRepo.find({
    where: { gameId: game.id, phase: game.phase, dayNumber: game.dayNumber },
  });
  const targetId = this.pickUniqueMaxTarget(this.tallyByTarget(votes));
  if (targetId === null) return null;   // hoà phiếu / không ai vote → không ai chết

  const target = await this.playersRepo.findOneBy({
    gameId: game.id,
    userId: targetId,
  });
  if (!target) return null;

  target.isAlive = false;
  await this.playersRepo.save(target);
  return target;
}
```

Hàm trả về **người vừa chết** (chứ không phải `void`) dù `advanceGame()` hiện chưa dùng tới giá trị đó — để sau này ghi nhật ký sự kiện và nguyên nhân chết ([PLAN.md §8.1, §8.2](../PLAN.md)) không phải kiểm phiếu lại lần nữa.

### 5.4. Nơi gọi `schedulePhase` / `cancelPhase`

| Chỗ | Gọi gì |
|---|---|
| `handleRoomStarted()` — sau khi tạo `games` + chia vai | `schedulePhase(gameId)` |
| `advanceGame()` — sau khi mở pha mới | `schedulePhase(gameId)` |
| `finishGame()` — ván kết thúc có người thắng | `cancelPhase(gameId)` |
| `handleRoomDeleted()` — phòng bị xoá, ván `CANCELLED` | `cancelPhase(gameId)` |

Đúng 3 chỗ như code hiện tại, chỉ đổi cách lưu timer.

---

## 6. Quyền bỏ phiếu và xem phiếu

Cả 2 pha đều mở cổng bỏ phiếu → các nhánh "chưa tới giờ bỏ phiếu" bị **xoá hẳn**.

### `castVote(gameId, voterId, targetUserId)`

| # | Kiểm tra | Lỗi khi sai | Đổi gì |
|---|---|---|---|
| 1 | Ván tồn tại | `NotFoundException` | — |
| 2 | `status === IN_PROGRESS` | `ConflictException` | — |
| 3 | ~~`phase` là pha vote~~ | — | **Xoá** — pha nào cũng vote được |
| 4 | Người vote thuộc ván | `ForbiddenException` | — |
| 5 | Người vote còn sống | `ForbiddenException` | — |
| 6 | Nếu `phase === NIGHT` → phải là Sói | `ForbiddenException` | — |
| 7 | Target thuộc ván | `NotFoundException` | — |
| 8 | Target còn sống | `ConflictException` | — |

Ghi/đổi phiếu giữ nguyên: có phiếu cũ thì UPDATE `targetId`, chưa có thì INSERT.

### `getVoteTally(gameId, requesterId)`

| Pha | Ai xem được | Đổi gì |
|---|---|---|
| `NIGHT` | Chỉ Sói, người khác `ForbiddenException` | — |
| `DAY` | Mọi người trong ván | **Xoá** nhánh `if (phase === DAY) throw ConflictException` đang có |

---

## 7. Thay đổi theo từng file

| File | Nội dung |
|---|---|
| `package.json` | `pnpm add @nestjs/schedule` |
| `src/app.module.ts` | `ScheduleModule.forRoot()` |
| `src/rooms/constants/room-configs.ts` | `ROLE_CONFIG_BY_MAX_PLAYERS` còn 2 vai (§3.1) |
| `src/game/constants/factions.ts` | Xoá `THIRD_PARTY_ROLES` |
| `src/game/constants/timing.ts` | Còn 1 hằng `PHASE_DURATION_MS = 60_000` |
| `src/game/entities/game.entity.ts` | `GamePhase` bỏ `DAY_VOTE` |
| `src/game/entities/game-vote.entity.ts` | Chỉ sửa comment cột `phase` |
| `src/game/game.service.ts` | Xem bên dưới |
| `src/game/game.controller.ts` | Không đổi |
| `src/game/game.module.ts` | Không đổi |
| `docs/game.md` | §1.1 mô tả bảng `games`; §3 luồng bắt đầu ván |
| `PLAN.md` | Mục 5 + backlog |

### `game.service.ts`

**Xoá:** `phaseTimers` Map, `scheduleTimer()`, `clearTimer()`, `resolveNightPhase()`, `startDayVote()`, `resolveDayPhase()`

**Thêm:** inject `SchedulerRegistry`, `phaseTimerName()`, `schedulePhase()`, `cancelPhase()`, `advanceGame()`, `resolveVoteKill()`

**Sửa:**
- `handleRoomStarted()` — `phaseEndsAt = now + 60s`, đổi sang `schedulePhase`
- `handleRoomDeleted()` — `clearTimer` → `cancelPhase`
- `finishGame()` — `clearTimer` → `cancelPhase`
- `castVote()` / `getVoteTally()` — bỏ các nhánh chặn pha (§6)

**Giữ nguyên:** `buildShuffledRoles`, `tallyByTarget`, `pickUniqueMaxTarget`, `revealRoleIfAllowed`, `checkWinCondition`, `getGameStateForUser`

---

## 8. Ảnh hưởng tới client / API

Không thêm/xoá endpoint. Hành vi đổi:

1. `GET /games/room/:roomId` không bao giờ trả `phase = "DAY_VOTE"` nữa; `myRole` chỉ còn `"werewolf"` hoặc `"villager"`.
2. `POST /games/:gameId/vote` ở pha `DAY` giờ **ghi phiếu thành công** (trước trả 409).
3. `GET /games/:gameId/votes` ở pha `DAY` giờ **trả kiểm phiếu** (trước trả 409).
4. Client đếm ngược theo `phaseEndsAt`, poll `GET /games/room/:roomId` mỗi 3–5s là đủ với pha 60s.

---

## 9. Trường hợp biên

| Tình huống | Xử lý |
|---|---|
| Không ai bỏ phiếu trong pha | `pickUniqueMaxTarget` trả `null` → không ai chết, sang pha kế |
| Hoà phiếu | Không ai chết — `pickUniqueMaxTarget` trả `null` |
| Sói chết hết ở pha `DAY` | `checkWinCondition` chạy trước khi chuyển pha → ván kết thúc, không sang `NIGHT` |
| Vote người đã chết | `castVote` chặn ở bước 8 |
| Người đã chết đi vote | `castVote` chặn ở bước 5 |
| Sói đã chết xem phiếu `NIGHT` | Chỉ check role, không check `isAlive` → Sói chết vẫn xem được. Giữ nguyên |
| Tự vote chính mình / Sói vote Sói | Không cấm, giữ nguyên hành vi hiện tại |
| Phòng bị xoá giữa ván | `room.deleted` → `status = CANCELLED` + `cancelPhase` |
| **Server restart giữa ván** | ⚠️ Ván đứng vĩnh viễn **và người chơi bị nhốt trong phòng** — nợ kỹ thuật, xem [PLAN.md §9](../PLAN.md) |

---

## 10. Đã thực thi theo thứ tự

1. ✅ `pnpm add @nestjs/schedule` + `ScheduleModule.forRoot()`
2. ✅ `room-configs.ts` (2 vai) + `factions.ts` + `timing.ts` + `GamePhase` enum
3. ✅ Tách `resolveVoteKill()` dùng chung cho cả 2 pha
4. ✅ Gộp 3 hàm resolve thành `advanceGame()`
5. ✅ `phaseTimers` Map → `SchedulerRegistry` (`schedulePhase` / `cancelPhase`)
6. ✅ Sửa `castVote()` / `getVoteTally()` bỏ các nhánh chặn pha
7. ✅ Cập nhật `docs/game.md`, `docs/game-rules.md`, `PLAN.md`
8. ❌ `onModuleInit` huỷ ván dở dang — **không làm**, ghi thành nợ kỹ thuật ([PLAN.md §9](../PLAN.md))

### Ghi chú về phiên bản `@nestjs/schedule`

Ghim ở **6.1.3**, không dùng 12.x. Bản 12 là ESM-only (`"type": "module"`): `require()` từ CommonJS vẫn chạy được nhờ Node ≥22.12 hỗ trợ require(ESM), nhưng Jest (CommonJS) không load nổi — `SyntaxError: Unexpected token 'export'`. 6.1.3 là bản CJS cuối cùng còn khai báo peer `@nestjs/common ^10 || ^11`, API `SchedulerRegistry` giống hệt. Nếu sau này nâng lên 12.x thì phải chuyển Jest sang ESM.

### Kiểm chứng

- `npx tsc --noEmit` sạch, `npx nest build` sạch.
- Kiểm tra DI (dùng tạm rồi xoá): `GameService` resolve được với `SchedulerRegistry` inject vào — `ScheduleModule.forRoot()` trả `global: true` và export `SchedulerRegistry` nên `GameModule` không cần import gì thêm.
- **Chưa chạy thử end-to-end**: máy dev không có Postgres ở `127.0.0.1:5432`, nên chưa xác minh được `synchronize` tạo lại enum `GamePhase` và vòng lượt chạy thật.

> Bạn đã ghi "ko cần test" trong `PLAN.md` nên không có test nào được commit. Thiết kế vẫn để `advanceGame()` gọi trực tiếp được, nên nếu đổi ý thì viết test không phải chờ 60 giây thật.
