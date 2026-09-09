# Kế hoạch kỹ thuật — Vai Tiên tri (Seer)

Thêm vai **Tiên tri**: mỗi đêm được soi **một** người, biết người đó **có phải Sói hay không**.

**Trạng thái: đã thực thi (2026-09-08).** Cả 7 quyết định ở §10 đều chốt theo phương án **A**. Tham chiếu: [luat-choi.md §4.2](./luat-choi.md) (luật của vai), [game-rounds.md](./game-rounds.md) (vòng lượt hiện tại), [PLAN.md §5](../PLAN.md) (luật ván chơi đang chạy).

---

## 1. Vì sao Tiên tri là vai dễ cài nhất

Đây là lý do [luat-choi.md §9](./luat-choi.md) xếp Tiên tri vào vị trí số 1 nên làm trước. Vai này **chỉ đọc thông tin, không thay đổi ai sống ai chết**, nên gần như toàn bộ hệ thống hiện tại không phải đụng vào:

| Phần | Có phải sửa? |
|---|---|
| Vòng lượt 2 pha, mỗi pha 60s | ❌ Không — Tiên tri soi ngay trong pha đêm sẵn có |
| Bộ hẹn giờ chuyển pha | ❌ Không |
| Kiểm phiếu, xác định người chết | ❌ Không — soi không ảnh hưởng kết quả |
| Điều kiện thắng | ❌ Không — Tiên tri tự động thuộc phe Dân |
| Quy tắc giấu vai trò | ❌ Không |
| Nguyên nhân chết ([PLAN.md §8.2](../PLAN.md)) | ❌ **Không phụ thuộc** — khác hẳn Người điên / Phù thuỷ / Thợ săn |
| Bỏ phiếu ban đêm của Sói | ❌ Không |

Việc duy nhất phải thêm là **một loại hành động mới, tách biệt hoàn toàn với bỏ phiếu**.

---

## 2. Soi khác bỏ phiếu ở chỗ nào

Điểm cốt lõi của thiết kế: **không được nhét hành động soi vào cơ chế bỏ phiếu hiện có.** Hai thứ này khác nhau về bản chất:

| | Bỏ phiếu | Soi của Tiên tri |
|---|---|---|
| Bao nhiêu người cùng làm | Cả nhóm (bầy Sói / cả làng) | Một mình |
| Kết quả tính thế nào | Cộng dồn rồi so số phiếu | Không cộng gì cả |
| Hệ quả | Có người chết | Không ai chết |
| Ai thấy kết quả | Cả nhóm cùng phe | Chỉ riêng Tiên tri |
| **Đổi ý được không** | **Được** — đổi phiếu thoải mái tới hết pha | **Không** — xem rồi thì không rút lại được |

Dòng cuối quan trọng nhất. Bỏ phiếu cho đổi vì chưa ai biết kết quả. Soi thì **vừa gọi là đã biết đáp án** — cho đổi thì Tiên tri soi được cả làng trong một đêm. Nên hành động soi phải là **ghi một lần, bất biến**.

---

## 3. Luật chi tiết cần cài

| # | Luật | Ghi chú |
|---|---|---|
| 1 | Chỉ dùng được trong **pha ban đêm** | Ban ngày gọi thì từ chối |
| 2 | Chỉ người có vai **Tiên tri** dùng được | |
| 3 | Tiên tri phải **còn sống** | Chết rồi thì hết quyền |
| 4 | **Mỗi đêm đúng 1 lần** | Đêm sau lại được soi tiếp |
| 5 | **Không rút lại, không đổi mục tiêu** | Xem §2 |
| 6 | Mục tiêu phải **thuộc ván** và **còn sống** | Người chết đã lộ vai, soi vô nghĩa |
| 7 | **Không được tự soi mình** | Tự biết vai mình rồi, chỉ phí lượt |
| 8 | Kết quả chỉ trả về **"là Sói" / "không phải Sói"** | **Không** trả tên vai cụ thể — xem §7 |
| 9 | Kết quả **chỉ Tiên tri thấy**, không ai khác | Xem §7 |
| 10 | Tiên tri xem lại được **lịch sử soi** của mình | Không bắt người chơi tự nhớ |

Tiên tri **vẫn bỏ phiếu bình thường ban ngày** như mọi người, và **vẫn bị chặn bỏ phiếu ban đêm** (vì không phải Sói) — hai điều này hệ thống hiện tại đã làm đúng, không phải sửa.

---

## 4. Mô hình dữ liệu

### 4.1. Bảng mới

Cần một bảng riêng cho **hành động của vai đặc biệt**, không dùng chung với bảng phiếu bầu.

Đề xuất tên: `game_actions` — bảng chung cho mọi vai có kỹ năng, không phải bảng riêng cho Tiên tri (xem **Quyết định #1**).

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `id` | serial PK | |
| `gameId` | FK → `games.id`, cascade xoá | |
| `dayNumber` | smallint | Lượt thứ mấy |
| `actionType` | enum | Hiện chỉ có `SEER_CHECK`; sau này thêm `GUARD_PROTECT`, `WITCH_HEAL`, `WITCH_POISON`, `HUNTER_SHOOT` |
| `actorId` | FK → `users.id` | Người dùng kỹ năng |
| `targetId` | FK → `users.id` | Người bị nhắm |
| `result` | varchar nullable | Kết quả trả cho người dùng kỹ năng. Với `SEER_CHECK`: `WEREWOLF` hoặc `NOT_WEREWOLF`. Các vai khác để `null` |
| `createdAt` | timestamp | |

**Ràng buộc:** `UNIQUE(gameId, dayNumber, actionType, actorId)`

Ràng buộc này chính là chỗ cài luật "mỗi đêm 1 lần" (§3 luật 4) — và vì **không có đường ghi đè** (chỉ INSERT, không bao giờ UPDATE) nên nó đồng thời cài luôn luật "không đổi ý" (§3 luật 5). Cố soi lần hai trong cùng đêm sẽ đụng ràng buộc và bị từ chối.

Không cần cột `phase` vì hiện mọi kỹ năng đều diễn ra ban đêm. Nếu sau này có kỹ năng ban ngày (Thợ săn bắn khi bị treo cổ) thì mới thêm.

### 4.2. Vì sao lưu `result` thay vì tính lại mỗi lần đọc

Vai trò không đổi trong suốt ván, nên tính lại vẫn ra đúng kết quả. Nhưng lưu lại có 2 cái lợi: đọc lịch sử soi không phải join sang bảng người chơi, và sau này nếu có vai làm thay đổi phe (Sói chúa biến người thành Sói) thì bản ghi vẫn phản ánh đúng **kết quả tại thời điểm soi**.

### 4.3. Bảng cũ

`games`, `game_players`, `game_votes` — **không đổi cột nào, không đổi ràng buộc nào**.

### 4.4. "Đêm nay" được định danh bằng gì

Không dùng thời gian, không dùng timestamp — dùng **`dayNumber`**.

Lý do nằm ở cách vòng lượt hiện tại tăng bộ đếm: `dayNumber` chỉ tăng khi chuyển từ **ngày sang đêm**, tức là **pha đêm và pha ngày của cùng một lượt mang cùng một `dayNumber`**:

```
dayNumber = 0     dayNumber = 0     dayNumber = 1     dayNumber = 1
   ĐÊM        →       NGÀY       →      ĐÊM        →      NGÀY      → ...
    ↑                                    ↑
  soi được                            soi được
```

Vì Tiên tri **chỉ soi được ban đêm**, mỗi giá trị `dayNumber` tương ứng với đúng **một** đêm soi được. Nên bộ ba `(ván, dayNumber, người soi)` đã đủ định danh "lượt soi của đêm nay" — **không cần thêm cột `phase`** vào bảng hành động.

Nếu sau này có kỹ năng dùng được ban ngày (Thợ săn bắn khi bị treo cổ) thì lúc đó mới phải thêm `phase` để phân biệt.

### 4.5. Hai tầng chặn "soi hai lần trong một đêm"

Cần **cả hai**, không phải chọn một:

**Tầng 1 — kiểm tra trước khi ghi.** Tìm trong bảng hành động xem đã có bản ghi `(ván, dayNumber hiện tại, SEER_CHECK, người gọi)` chưa. Có rồi → từ chối 409 kèm thông báo dễ hiểu.

**Tầng 2 — ràng buộc UNIQUE ở tầng DB.** Tầng 1 có khe hở kinh điển: giữa lúc *kiểm tra* và lúc *ghi* có một khoảng trống. Người chơi bấm nút hai lần thật nhanh, hoặc mạng lag rồi client tự gửi lại, thì **hai request cùng đọc thấy "chưa soi" rồi cùng ghi** → Tiên tri soi được 2 người trong một đêm. Ràng buộc UNIQUE là thứ duy nhất bịt được khe này: request thứ hai sẽ đụng ràng buộc và bị DB chặn.

Khi đụng ràng buộc, mã lỗi Postgres `23505` phải được **bắt lại và chuyển thành đúng 409** như tầng 1, để client thấy hành vi nhất quán dù rơi vào nhánh nào. Dự án đã có sẵn cách xử lý `23505` ở chỗ sinh mã phòng — làm theo đúng kiểu đó.

> Chỉ có tầng 1 thì sai trong trường hợp hiếm. Chỉ có tầng 2 thì đúng nhưng thông báo lỗi khó hiểu. Có cả hai thì vừa đúng vừa dễ dùng.

---

## 5. Cấu hình vai trò

Thêm 1 Tiên tri vào mỗi mốc, lấy bớt 1 Dân thường. Số Sói giữ nguyên:

| Số người | Hiện tại | Sau khi thêm |
|---|---|---|
| 6 | 1 Sói, 5 Dân | 1 Sói, 4 Dân, **1 Tiên tri** |
| 8 | 2 Sói, 6 Dân | 2 Sói, 5 Dân, **1 Tiên tri** |
| 10 | 2 Sói, 8 Dân | 2 Sói, 7 Dân, **1 Tiên tri** |
| 15 | 3 Sói, 12 Dân | 3 Sói, 11 Dân, **1 Tiên tri** |

Việc chia vai không phải sửa gì — thuật toán hiện tại đọc thẳng từ bảng cấu hình rồi xáo trộn, thêm key mới là tự chạy.

Phe cũng không phải khai báo gì: hệ thống chia phe theo nguyên tắc "không phải Sói thì thuộc phe Dân", nên Tiên tri tự động vào phe Dân và được tính đúng trong điều kiện thắng.

> ⚠️ **Lưu ý cân bằng:** mốc 6 người sẽ thành 1 Sói / 5 người phe Dân, trong đó có Tiên tri. Tiên tri chỉ cần 1–2 đêm là tìm ra con Sói duy nhất → phe Dân thắng gần như chắc. Xem **Quyết định #4**.

---

## 6. API

### 6.1. Hai endpoint mới

| Method | Path | Mô tả |
|---|---|---|
| `POST` | `/games/:gameId/seer/check` | Body `{ targetUserId }`. Soi 1 người trong đêm hiện tại |
| `GET` | `/games/:gameId/seer/checks` | Lịch sử soi của **chính người gọi**, từ đầu ván |

Đặt route riêng cho từng vai (`/seer/...`) thay vì một endpoint chung `/actions` — vì mỗi vai có kiểu dữ liệu vào/ra khác hẳn nhau (Bảo vệ không trả về gì, Phù thuỷ có 2 loại thuốc), gộp lại sẽ thành một union khó đọc và khó validate.

### 6.2. Phản hồi khi soi thành công

```
{
  "dayNumber": 2,
  "targetUserId": 17,
  "isWerewolf": true
}
```

Trả kết quả **ngay trong phản hồi**, không đợi hết pha (xem **Quyết định #3**).

### 6.3. Các trường hợp từ chối

| Tình huống | Mã lỗi |
|---|---|
| Ván không tồn tại | 404 |
| Ván đã kết thúc / bị huỷ | 409 |
| Đang là pha ban ngày | 409 |
| Người gọi không thuộc ván | 403 |
| Người gọi không phải Tiên tri | 403 |
| Tiên tri đã chết | 403 |
| Đêm nay đã soi rồi | 409 |
| Mục tiêu không thuộc ván | 404 |
| Mục tiêu đã chết | 409 |
| Tự soi chính mình | 400 |

### 6.4. Làm sao client biết "đêm nay đã soi rồi" **trước khi** bấm

Ba mục trên mới chỉ giải quyết phía server: gọi lần hai thì bị từ chối. Nhưng client cần biết **trước** để khoá nút và hiện lại kết quả đã soi — chứ không phải để người chơi bấm rồi ăn lỗi.

Thông tin này thuộc về **endpoint cá nhân** `GET /games/:gameId/me` ([game.md §9.2](./game.md)) — không nhét vào endpoint trạng thái ván, vì endpoint đó phải giữ nguyên tắc "không phụ thuộc người xem".

```
GET /games/:gameId/me

{
  "userId": 3,
  "role": "seer",
  "isAlive": true,
  "canVoteNow": true,
  "myVoteTargetId": null,

  "seer": {                          ← chỉ xuất hiện khi người gọi là Tiên tri
    "canCheckNow": false,            ← còn quyền soi đêm nay không
    "checkedThisNight": {            ← null nếu đêm nay chưa soi
      "targetUserId": 17,
      "isWerewolf": true
    }
  }
}
```

Được 3 thứ:

- **Không tốn thêm lần gọi nào** — client đã phải poll `/me` để biết `canVoteNow` rồi.
- **Client không phải tự suy luận.** Nếu chỉ có endpoint lịch sử soi thì client phải tự lọc theo `dayNumber` hiện tại — dễ sai, và mỗi client lại tự viết một kiểu.
- **Người chơi F5 hoặc đổi máy vẫn thấy lại kết quả đã soi**, không mất thông tin.

`canCheckNow` phải tính gộp cả các điều kiện khác chứ không chỉ mỗi "đã soi chưa": phải đang là pha đêm, Tiên tri phải còn sống, và ván phải đang chạy. Nói cách khác nó trả lời đúng câu "bây giờ bấm nút soi có được không".

**Bắt buộc:** khối `seer` chỉ được dựng khi **chính người gọi** có vai Tiên tri, và dữ liệu lấy theo danh tính từ access token. Vai khác gọi `/me` thì phản hồi **không được có khoá `seer`** — kể cả rỗng, vì sự tồn tại của khoá đó cũng đã là tín hiệu rò rỉ.

Endpoint lịch sử soi ở §6.1 vẫn giữ, dùng cho việc xem lại toàn bộ các đêm trước.

---

## 7. Bảo mật thông tin — phần quan trọng nhất

Toàn bộ giá trị của vai Tiên tri nằm ở chỗ **chỉ mình họ biết kết quả**. Rò rỉ một lần là hỏng cả ván. Ba nguyên tắc bắt buộc:

**1. Kết quả không bao giờ đi ra ngoài người soi.**
Endpoint xem trạng thái ván (`GET /games/room/:roomId`) và endpoint kiểm phiếu **tuyệt đối không được** chứa bất kỳ dữ liệu nào từ bảng hành động. Lịch sử soi chỉ đọc được qua đúng một đường: người gọi tự xem lịch sử của chính mình, và phải lọc theo danh tính lấy từ access token — **không** lấy từ tham số client gửi lên.

**2. Chỉ trả nhị phân, không trả tên vai.**
Kết quả là "là Sói" / "không phải Sói". Nếu trả thẳng tên vai thì Tiên tri biết luôn ai là Phù thuỷ, ai là Thợ săn — vai này sẽ mạnh tới mức làm hỏng cân bằng, và các vai đặc biệt khác mất hết ý nghĩa.

**3. Không được lộ "có Tiên tri còn sống hay không".**
Hệ quả cụ thể: khi Tiên tri gọi soi mà bị từ chối vì đã soi rồi, thông báo lỗi phải trung tính. Và tuyệt đối không được có kiểu endpoint "đêm nay đã có ai soi chưa" cho người ngoài gọi.

Một điểm dễ bỏ sót: **Tiên tri chết thì vai bị công khai** (quy tắc lộ vai hiện có đã làm vậy). Đó là hành vi đúng theo luật, không phải rò rỉ — nhưng lịch sử soi của họ thì vẫn phải giữ kín, không được công bố kèm.

---

## 8. Thay đổi theo từng file

| File | Nội dung |
|---|---|
| `src/game/entities/game-action.entity.ts` | **Mới** — bảng `game_actions` (§4.1) |
| `src/game/constants/` | **Mới** — enum `GameActionType` (hiện chỉ `SEER_CHECK`), hằng tên vai `SEER_ROLE` |
| `src/rooms/constants/room-configs.ts` | Thêm `seer: 1` vào cả 4 mốc, giảm `villager` đi 1 (§5) |
| `src/game/dto/` | **Mới** — DTO cho body `{ targetUserId }` |
| `src/game/game.service.ts` | Thêm 2 nghiệp vụ (soi, đọc lịch sử soi) + dựng khối `seer` trong nghiệp vụ `/me` |
| `src/game/game.controller.ts` | Thêm 2 route (§6.1) |
| `src/game/game.module.ts` | Đăng ký entity mới |
| `src/app.module.ts` | Đăng ký entity mới |
| `docs/game-rules.md`, `docs/luat-choi.md`, `PLAN.md` | Cập nhật trạng thái vai Tiên tri |

**Không đụng tới:** logic chuyển pha, bộ hẹn giờ, kiểm phiếu, điều kiện thắng, quy tắc lộ vai, bảng `games` / `game_players` / `game_votes`.

Ước lượng: khoảng **150 dòng thêm mới**, gần như không sửa code cũ ngoài bảng cấu hình vai.

---

## 9. Trường hợp biên

| Tình huống | Xử lý |
|---|---|
| Tiên tri soi rồi chết ngay đêm đó | Kết quả đã trả rồi, bản ghi vẫn còn. Đêm sau không soi được nữa vì đã chết |
| Tiên tri chết trước khi kịp soi | Mất lượt, không có gì đặc biệt |
| Tiên tri soi trúng Sói ngay đêm 1 | Đúng luật. Vấn đề là họ thuyết phục cả làng thế nào mà không lộ thân phận |
| Không có ai vai Tiên tri trong ván | Không sao — endpoint luôn trả 403, không ảnh hưởng gì |
| Ván có 2 Tiên tri (nếu sau này cấu hình vậy) | Ràng buộc theo `actorId` nên mỗi người vẫn được 1 lượt riêng, chạy đúng |
| Gọi soi đúng lúc pha vừa đổi sang ngày | Kiểm tra pha đọc trạng thái mới nhất trong DB nên sẽ bị từ chối. Có thể lệch dưới 1 giây — chấp nhận được |
| Soi cùng một người nhiều đêm | Cho phép, chỉ là phí lượt. Không cần chặn |
| Ván bị huỷ giữa chừng | Bản ghi hành động bị xoá theo ván (cascade) |

---

## 10. Quyết định cần bạn chốt

### #1 — Bảng chung `game_actions` hay bảng riêng `game_seer_checks`?

- **A. Bảng chung** (đề xuất): một bảng cho mọi kỹ năng, phân biệt bằng cột loại hành động. Bảo vệ / Phù thuỷ / Thợ săn sau này chỉ cần thêm giá trị vào enum, không phải tạo bảng mới. Chi phí lúc này gần như bằng 0 vì chỉ khác đúng 1 cột.
- B. Bảng riêng cho Tiên tri: gọn hơn một chút bây giờ, nhưng cứ mỗi vai lại một bảng, và mỗi lần thêm là một lần đổi schema.

### #2 — Có cấm tự soi chính mình không?

- **A. Cấm** (đề xuất): tự soi là phí lượt trắng, gần như chắc chắn do bấm nhầm.
- B. Cho phép: người chơi tự chịu trách nhiệm.

### #3 — Trả kết quả ngay hay đợi hết pha đêm?

- **A. Trả ngay trong phản hồi** (đề xuất): đúng với cảm giác chơi thật, và không cần cơ chế thông báo nào cả.
- B. Đợi hết pha mới cho xem: cần thêm chỗ chứa "thông báo chờ đọc", phức tạp hơn hẳn mà không được gì.

### #4 — Có tăng số Sói ở mốc 6 người không?

Thêm Tiên tri làm phe Dân mạnh lên rõ rệt. Mốc 6 người với 1 Sói duy nhất sẽ rất lệch — Tiên tri soi 1–2 đêm là ra.

- **A. Giữ 1 Sói** (đề xuất): đổi một thứ tại một thời điểm. Chơi thử vài ván rồi hãy chỉnh, đừng đoán.
- B. Tăng lên 2 Sói ngay: `2 Sói, 3 Dân, 1 Tiên tri`. Cân hơn về lý thuyết nhưng chưa có dữ liệu thực tế để khẳng định.

### #5 — Sau khi ván kết thúc có công khai lịch sử soi không?

- **A. Không** (đề xuất): giữ kín vĩnh viễn, đơn giản nhất.
- B. Công khai khi ván đã kết thúc: hay cho phần tổng kết ván, nhưng phải chờ tính năng tổng kết ([PLAN.md §8.7](../PLAN.md)) mới có chỗ hiển thị.

### #6 — Báo trạng thái "đã soi đêm nay" cho client bằng cách nào?

- **A. Thêm khối `seer` vào endpoint cá nhân `/games/:gameId/me`** (đề xuất, §6.4): không tốn thêm lần gọi nào vì client đã poll `/me` sẵn, và client không phải tự lọc theo `dayNumber`.
- B. Thêm endpoint riêng `GET /games/:gameId/seer/check` trả lượt soi của đêm nay: tách bạch hơn, nhưng client phải gọi thêm một lần nữa mỗi vòng poll.
- C. Chỉ có endpoint lịch sử, client tự lọc theo `dayNumber` hiện tại: không phải thêm gì cả, nhưng đẩy phần dễ sai sang cho client và mỗi client lại tự làm một kiểu.

### #7 — Có cho Tiên tri soi người đã chết không?

**Chốt: cấm.** Người chết đã lộ vai cho cả làng rồi ([PLAN.md §5.7](../PLAN.md)), nên soi họ là phí trắng một lượt.

---

## 11. Thứ tự thực hiện

1. Enum loại hành động + hằng tên vai Tiên tri — thuần dữ liệu
2. Entity `game_actions` + đăng ký ở 2 chỗ (module con và module gốc)
3. Thêm `seer` vào bảng cấu hình vai trò
4. Nghiệp vụ soi: kiểm tra 10 điều kiện ở §6.3, ghi bản ghi (có bắt lỗi `23505` theo §4.5), trả kết quả nhị phân
5. Nghiệp vụ đọc lịch sử soi của chính mình
6. Hai route mới
6b. Thêm khối `seer` vào endpoint cá nhân `/games/:gameId/me` (§6.4) — chỉ dựng khi người gọi là Tiên tri
7. Rà lại §7 — đọc kỹ hai endpoint cũ, xác nhận không có đường nào rò dữ liệu bảng hành động
8. Cập nhật tài liệu

Bước 1–3 không đổi hành vi gì (chưa ai gọi được kỹ năng) nên commit riêng được.

**Bước 7 là bước không được bỏ qua** — đây là loại lỗi mà compiler không bắt được, và nếu lọt thì phải chơi thật mới phát hiện, lúc đó đã hỏng ván.

---

## 12. Cách kiểm chứng thủ công

Bạn đã chốt không viết test, nên đây là kịch bản chạy tay khi có DB:

1. Tạo phòng 6 người, cho đủ người vào, bắt đầu ván.
2. Gọi trạng thái ván bằng từng tài khoản để tìm ai được chia vai Tiên tri.
3. Trong pha đêm, Tiên tri soi một người → nhận kết quả nhị phân.
4. Soi lần hai trong cùng đêm → phải bị từ chối 409.
4b. Bấm soi **hai lần thật nhanh** (hoặc gửi 2 request song song) → chỉ 1 cái thành công, cái còn lại 409 chứ không phải lỗi 500. Đây là chỗ kiểm tra tầng chặn UNIQUE ở §4.5.
4c. Gọi `/games/:gameId/me` bằng tài khoản Tiên tri → khối `seer` phải có `canCheckNow: false` và hiện lại đúng kết quả vừa soi.
5. Dân thường gọi soi → phải bị từ chối 403.
6. Đợi sang pha ngày, Tiên tri gọi soi → phải bị từ chối 409.
7. Sang đêm sau, Tiên tri soi lại → phải thành công.
8. **Quan trọng nhất:** gọi trạng thái ván và kiểm phiếu bằng **tài khoản khác**, kiểm tra kỹ toàn bộ phản hồi — không được có bất kỳ dấu vết nào của việc ai đã soi ai.
