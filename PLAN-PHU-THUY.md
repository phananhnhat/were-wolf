# Kế hoạch kỹ thuật — Pha kỹ năng & vai Phù thuỷ (Witch)

**Trạng thái: đã code xong (2026-09-15).** Chi tiết đã đổi/thêm khi thi công so với bản kế hoạch: xem [docs/impl-phu-thuy.md](./docs/impl-phu-thuy.md) — không có sai lệch về logic, chỉ có 1 phát hiện thêm lúc rà soát (§1.1 của tài liệu đó, về việc kết hợp với Thợ săn sau này).

Phù thuỷ có **2 bình thuốc, mỗi bình dùng đúng 1 lần trong cả ván**:

- **Thuốc cứu** — cứu người vừa bị Sói cắn trong đêm
- **Thuốc độc** — giết 1 người bất kỳ

**Đã chốt:** thêm **một pha kỹ năng** vào vòng lượt, để Phù thuỷ **nhìn thấy ai bị Sói cắn** rồi mới quyết định cứu.

Tham chiếu: [docs/game-rules.md §4](./docs/game-rules.md), [docs/luat-choi.md §4.4](./docs/luat-choi.md), [docs/role-bao-ve.md](./docs/role-bao-ve.md), [docs/game-rounds.md](./docs/game-rounds.md).

> **Tài liệu thi công** (đụng file nào, bảng nào, hàm nào): [docs/impl-phu-thuy.md](./docs/impl-phu-thuy.md). File này chỉ nói luật chơi và lý do thiết kế.

> **Đã tiếp thu toàn bộ phản hồi của bạn.** Hai chỗ bạn chỉ ra là **tôi thiết kế sai**: không cần cột lưu nạn nhân (§3.3), và bỏ pha kỹ năng khi Phù thuỷ chết thì **không rò rỉ gì** (§2). Các quyết định đã chốt liệt kê ở §12.

---

## 1. Vòng lượt mới

```
   pha 2                    pha 3                      pha 1
┌──────────┐          ┌───────────────┐          ┌──────────┐
│   ĐÊM    │   ───►   │   KỸ NĂNG     │   ───►   │   NGÀY   │  ───► lượt kế
│   60s    │          │   15s         │          │   60s    │
├──────────┤          ├───────────────┤          ├──────────┤
│ Sói vote │          │ Phù thuỷ: xem │          │ cả làng  │
│ Bảo vệ   │          │  nạn nhân →   │          │ bỏ phiếu │
│ Tiên tri │          │  CỨU hay ko   │          │ treo cổ  │
│ PT: độc  │          │               │          │          │
│          │          │               │          │          │
└────┬─────┘          └───────┬───────┘          └────┬─────┘
     │                        │                       │
     ▼                        ▼                       ▼
 chưa ai chết          ÁP DỤNG hết cái          treo cổ người
 (chỉ đóng cổng        chết của đêm →           nhiều phiếu nhất
  bỏ phiếu Sói)        xét thắng thua           → xét thắng thua
```

Đánh số theo cách bạn ghi ở §12: **pha 1 = ngày, pha 2 = đêm, pha 3 = kỹ năng**. Vòng chạy thực tế vẫn mở màn bằng **đêm** như hiện tại (ván bắt đầu là vào đêm luôn).

| Pha | Dài | Ai được làm gì | Khi pha đóng |
|---|---|---|---|
| **ĐÊM** (2) | 60s | Sói bỏ phiếu cắn · Bảo vệ che · Tiên tri soi · Phù thuỷ **đầu độc** | Đóng cổng bỏ phiếu. **Chưa ai chết** |
| **KỸ NĂNG** (3) | **15s** | **Chỉ** Phù thuỷ: xem nạn nhân rồi quyết **cứu hay không** | **Áp dụng toàn bộ cái chết** của đêm → xét thắng thua |
| **NGÀY** (1) | 60s | Cả làng bỏ phiếu treo cổ | Treo cổ → xét thắng thua → sang lượt mới |

**Kỹ năng nào dùng được ở pha nào** (đã chốt theo §12 Quyết định #1):

| Kỹ năng | Pha ĐÊM | Pha KỸ NĂNG | Vì sao |
|---|---|---|---|
| Sói bỏ phiếu cắn | ✅ | ❌ | Phải đóng cổng để chốt nạn nhân cho Phù thuỷ xem |
| Tiên tri soi | ✅ | ❌ | Không phụ thuộc nạn nhân → không cần chờ |
| Bảo vệ che | ✅ | ❌ | Không phụ thuộc nạn nhân → không cần chờ |
| Phù thuỷ **đầu độc** | ✅ | ❌ | Không phụ thuộc nạn nhân → không cần chờ |
| Phù thuỷ **cứu** | ❌ | ✅ | **Bắt buộc** chờ chốt nạn nhân — đây là lý do duy nhất pha này tồn tại |

Nói gọn: **pha KỸ NĂNG chỉ tồn tại để phục vụ đúng một quyết định — cứu hay không cứu.** Mọi kỹ năng khác vẫn nằm trọn trong pha ĐÊM như trước.

Nhờ vậy 15 giây là đủ: Phù thuỷ chỉ cần đọc tên nạn nhân rồi bấm một nút, không phải chọn ai trong danh sách.

> Cách này còn gọn hơn ở chỗ **không phải nới kỹ năng nào ra hai cửa sổ**. Mỗi kỹ năng có đúng một pha để dùng, nên không có chuyện "dùng ở pha đêm rồi sang pha kỹ năng gọi lại" — và cũng không cần lý luận gì về việc ràng buộc "1 lần mỗi lượt" có trải qua hai pha hay không.

---

## 2. Khi nào bỏ qua pha KỸ NĂNG

Bạn đúng ở §12.4, và lập luận rò rỉ ở bản trước của tôi **sai**.

Tôi đã lo rằng bỏ pha khi không còn vai kỹ năng sẽ tiết lộ "Phù thuỷ đã chết". Nhưng luật hiện hành là **người chết thì lộ vai cho tất cả mọi người** — nên "Phù thuỷ còn sống hay không" **vốn đã là thông tin công khai**. Ai cũng tự suy ra được. Vậy sự có mặt của pha kỹ năng **không mang thêm một bit thông tin nào**, và bỏ qua nó hoàn toàn an toàn.

### Điều kiện

> Pha KỸ NĂNG chỉ diễn ra khi **còn người sống mang vai cần tới nó** — tức là kỹ năng phụ thuộc vào việc biết kết quả của đêm.

"Cần tới nó" = kỹ năng phụ thuộc vào việc biết kết quả của đêm:

| Vai | Có cần pha kỹ năng? |
|---|---|
| **Phù thuỷ** | ✅ Cần — thuốc cứu phải biết nạn nhân |
| Bảo vệ | ❌ Không — che được ngay trong đêm |
| Tiên tri | ❌ Không — soi được ngay trong đêm |
| **Thợ săn** (sau này) | ❌ Không — đã chốt phương án khai báo trước, xem §14 |

Nên điều kiện rút gọn còn đúng một câu: **pha kỹ năng diễn ra khi và chỉ khi Phù thuỷ còn sống.** Chết rồi → bỏ pha, vòng lượt về lại 2 pha và ngắn đi 15 giây.

Trong toàn bộ bộ vai đang có và sắp có, **Phù thuỷ là vai duy nhất cần pha này** — vì cô ấy là vai duy nhất có kỹ năng phụ thuộc vào kết quả của đêm.

### Một chỗ vẫn phải cẩn thận

**Không được bỏ pha vì "Phù thuỷ đã hết cả 2 bình thuốc".**

Đây là chỗ khác biệt tinh vi so với điểm trên. Việc còn sống hay đã chết là công khai, nhưng việc **còn thuốc hay đã tiêu hết thì vẫn là bí mật**. Nếu pha kỹ năng biến mất đúng lúc cô ấy vừa tiêu bình cuối, cả làng biết ngay là Phù thuỷ đã cạn thuốc — và từ đó Sói không còn phải e dè nữa.

Nên điều kiện chỉ xét **còn sống hay không**, tuyệt đối không xét **còn thuốc hay không**.

---

## 3. Lưu ở đâu

### 3.1. Bảng `game_actions` — dùng chung, thêm 2 loại hành động

Bảng đã có sẵn cho Tiên tri và Bảo vệ. Thêm 2 loại:

| Loại hành động | Mục tiêu | Kết quả |
|---|---|---|
| `WITCH_HEAL` | người được cứu = **chính nạn nhân bị Sói cắn** | không dùng |
| `WITCH_POISON` | người bị đầu độc | không dùng |

Việc Phù thuỷ nhìn thấy nạn nhân **giải quyết luôn một vướng mắc của phương án cũ**: trước đây thuốc cứu không có mục tiêu nên vướng cột mục tiêu đang `NOT NULL`. Giờ bản ghi thuốc cứu có mục tiêu thật — **không phải đổi kiểu cột nào**.

### 3.2. Ràng buộc "mỗi bình 1 lần cả ván"

Ràng buộc hiện có là **theo từng lượt** (`ván + lượt + loại hành động + người dùng`) — đúng cho Tiên tri và Bảo vệ, nhưng không chặn được việc đêm 1 dùng thuốc độc rồi đêm 2 dùng tiếp.

Cần thêm một ràng buộc nữa, **bỏ "lượt" ra khỏi khoá**, chỉ áp cho 2 loại của Phù thuỷ:

> Trong một ván, mỗi người chỉ được có **tối đa một** bản ghi `WITCH_HEAL` và **tối đa một** bản ghi `WITCH_POISON`.

Hai ràng buộc cùng tồn tại, không đụng nhau. Nhờ vậy bảng hành động là **nguồn sự thật duy nhất** cho câu hỏi "còn thuốc không".

> ⚠️ Ràng buộc có điều kiện là thứ `synchronize: true` xử lý không phải lúc nào cũng ổn định — có phiên bản TypeORM xoá rồi tạo lại mỗi lần khởi động. **Phải kiểm chứng thật với DB.** Phương án dự phòng ở §12 Quyết định #3.

### 3.3. KHÔNG thêm cột nào vào bảng `games`

Bản trước tôi đề xuất thêm cột "nạn nhân đang chờ". **Bạn đúng ở §12.2 — cột đó không cần.**

Nạn nhân **tính lại được bất cứ lúc nào** từ phiếu bầu của Sói trong lượt đó. Và kết quả tính lại **luôn giống nhau**, vì:

- Phiếu bầu của Sói đã nằm sẵn trong bảng phiếu, khoá theo `lượt + pha ĐÊM`
- Pha ĐÊM đóng lại là **đóng luôn cổng bỏ phiếu** — sang pha KỸ NĂNG không ai bỏ phiếu được nữa
- Nên bảng phiếu của lượt đó **đã đóng băng**, tính bao nhiêu lần cũng ra một đáp án

Được 3 thứ khi bỏ cột đi:

1. Không thêm cột, không đổi schema bảng `games`
2. Không có bước "xoá về rỗng" — mà đó chính là loại lỗi âm thầm khó tìm nhất (sót lại thì đêm sau đọc ra dữ liệu cũ)
3. Không có hai nguồn sự thật cho cùng một dữ kiện

**Về đề xuất thay thế của bạn** — ghi một bản ghi `WOLF_BITE` vào bảng hành động: đúng là chỗ hợp lý, nhưng bảng đó đòi cột "người thực hiện", mà vết cắn là **quyết định tập thể của cả bầy Sói**, không có một người thực hiện duy nhất. Nhồi vào sẽ phải bịa dữ liệu. Nên chưa cần. Khi nào làm **nhật ký sự kiện** ([PLAN.md §8.1](./PLAN.md)) thì đó mới là chỗ đúng để ghi lại "đêm N, Sói cắn X, kết quả Y".

### 3.4. Danh sách pha — thêm 1 giá trị

Cột pha của ván (và cột pha của bảng phiếu bầu, vì dùng chung một kiểu liệt kê) cần thêm giá trị cho pha kỹ năng. Sẽ không bao giờ có phiếu bầu nào mang giá trị này.

### 3.5. Thời lượng pha

Hiện mọi pha dùng **một** hằng số 60 giây. Giờ có 2 thời lượng, nên cần bảng tra **thời lượng theo pha**: ĐÊM 60s, KỸ NĂNG **15s**, NGÀY 60s.

### 3.6. Không đụng tới

Bảng người chơi trong ván, bảng phiếu bầu — **không đổi cột nào, không đổi ràng buộc nào**.

---

## 4. Logic từng thời điểm

### 4.1. Đóng pha ĐÊM

```
1. KHÔNG kiểm phiếu, KHÔNG giết ai, KHÔNG xét thắng thua
   (pha này không còn là nơi xử lý cái chết nữa)

2. Phù thuỷ còn sống không?
      CÓ     →  mở pha KỸ NĂNG
      KHÔNG  →  xử lý toàn bộ cái chết của đêm NGAY TẠI ĐÂY
                (đúng logic ở §4.3), rồi mở pha NGÀY
```

Việc đóng pha ĐÊM giờ gần như **không làm gì** — nó chỉ đóng cổng bỏ phiếu của Sói lại. Toàn bộ phần tính toán dồn về §4.3.

**Lưu ý về thời điểm xét "còn sống":** xét ở đây là **trước khi áp dụng cái chết của đêm nay**. Nên nếu chính Phù thuỷ là người bị Sói cắn đêm nay, pha kỹ năng **vẫn mở** và cô ấy **vẫn kịp tự cứu mình**. Đúng như mong muốn — xét sau thì cô ấy chết trước khi kịp phản ứng.

**Số lượt không đổi khi sang pha kỹ năng.** Bộ đếm lượt chỉ tăng lúc đóng pha NGÀY, nên ĐÊM, KỸ NĂNG và NGÀY của cùng một lượt mang **cùng một số lượt**. Nhờ vậy ở §4.3 việc kiểm lại phiếu của pha ĐÊM và tra bản ghi thuốc đều dùng chung một số lượt, không phải trừ lùi gì.

### 4.2. Trong pha KỸ NĂNG

Pha này có **đúng một việc**: Phù thuỷ còn sống xem nạn nhân rồi quyết định cứu hay không.

| Hành động | Điều kiện | Ghi nhận |
|---|---|---|
| **Cứu** | Còn thuốc cứu, **và lượt này có nạn nhân** | Bản ghi `WITCH_HEAL`, mục tiêu = nạn nhân |

Thuốc độc **không dùng được ở pha này** — nó thuộc pha ĐÊM (§1). Tiên tri và Bảo vệ cũng vậy.

Nếu lượt này **không có nạn nhân** (Sói hoà phiếu / không ai bỏ phiếu) thì **không gọi được thuốc cứu**. Đây là cải thiện rõ so với phương án mù: Phù thuỷ **nhìn thấy** là không có ai để cứu, nên không thể tiêu thuốc vô ích.

**Mọi người, kể cả Sói, đều không bỏ phiếu được trong pha này.** Xem §5 — đây là chỗ phải sửa code, không tự đúng.

**Mọi kỹ năng khác gọi vào pha này đều bị từ chối** — kể cả thuốc độc của chính Phù thuỷ. Nên áp dụng theo kiểu **danh sách pha cho phép cho từng kỹ năng**, để các vai thêm về sau không mặc định lọt vào pha này.

### 4.3. Áp dụng cái chết — phần lõi

Chạy khi **đóng pha KỸ NĂNG**, hoặc khi **đóng pha ĐÊM** nếu lượt đó không có pha kỹ năng.

```
── Bước 1: xác định nạn nhân của Sói ──────────────────────
kiểm phiếu pha ĐÊM của lượt này
người nhiều phiếu nhất  →  nạn nhân
hoà phiếu / không ai bỏ →  không có nạn nhân

── Bước 2: gom các cái chết ───────────────────────────────
deaths = TẬP HỢP rỗng        ← TẬP, không phải danh sách

nếu có nạn nhân:
     nếu Bảo vệ che đúng người đó        →  sống, bỏ qua
     ngược lại, nếu có bản ghi thuốc cứu →  sống, bỏ qua
     ngược lại                           →  deaths += nạn nhân

nếu có bản ghi thuốc độc của lượt này:
     deaths += mục tiêu của nó
     ── Bảo vệ KHÔNG chặn được thuốc độc
     ── thuốc cứu KHÔNG cứu được người trúng độc

── Bước 3: áp dụng ───────────────────────────────────────
đánh dấu tất cả người trong deaths là đã chết
xét điều kiện thắng MỘT LẦN DUY NHẤT
     thắng  →  kết thúc ván, dừng
     chưa   →  mở pha NGÀY
```

**Ba điều bắt buộc:**

1. **Dùng tập hợp.** Phù thuỷ hoàn toàn có thể đầu độc đúng người Sói vừa cắn. Cộng dồn thì sẽ xử lý cái chết hai lần.

2. **Xét thắng thua đúng một lần, sau khi đã áp dụng hết cái chết.** Xét sau từng cái chết là sai: thuốc độc giết con Sói cuối cùng trong khi Sói cũng vừa cắn chết một Dân — kết quả ván sẽ **phụ thuộc thứ tự xử lý**, hôm nay Dân thắng mai lại Sói thắng.

3. **Bước 1 tính lại từ bảng phiếu**, không đọc từ cột nào — xem §3.3.

### 4.4. Đóng pha NGÀY

Không đổi: kiểm phiếu cả làng, treo cổ người nhiều phiếu nhất, xét thắng thua, tăng số lượt, mở pha ĐÊM.

**Không** áp dụng che của Bảo vệ, **không** áp dụng thuốc men — cả hai chỉ có tác dụng ban đêm.

### 4.5. Xét điều kiện thắng ở đâu

Bạn nói đúng ở §12.3, và nó khớp với thiết kế. Nguyên tắc: **xét đúng ở những thời điểm vừa có người chết.**

| Thời điểm | Có người chết? | Xét thắng thua? |
|---|---|---|
| Đóng pha ĐÊM (khi **có** pha kỹ năng) | Không | ❌ Không |
| Đóng pha ĐÊM (khi **không có** pha kỹ năng) | Có | ✅ Có |
| Đóng pha KỸ NĂNG | Có | ✅ Có |
| Đóng pha NGÀY | Có | ✅ Có |

---

## 5. Một lỗi sẽ phát sinh nếu không sửa: bỏ phiếu trong pha kỹ năng

Chỗ này **không tự đúng**, phải sửa chủ động.

Hàm bỏ phiếu hiện tại **không có danh sách pha được phép**. Nó chỉ có đúng một luật liên quan tới pha: *"nếu đang là ĐÊM thì người bỏ phiếu phải là Sói"*. Mọi pha khác đều **mặc định cho bỏ phiếu**.

Nghĩa là ngay khi thêm pha kỹ năng vào, **cả làng sẽ bỏ phiếu được trong pha đó** như thể đang là ban ngày — vì pha mới không phải ĐÊM nên nhánh kiểm tra Sói không chạy. Hậu quả: có thêm một lượt treo cổ lậu mỗi đêm.

**Phải đổi sang danh sách cho phép:** chỉ ĐÊM (Sói) và NGÀY (cả làng) mở cổng bỏ phiếu; mọi pha khác từ chối. Làm theo kiểu danh sách cho phép thì các pha thêm về sau cũng tự động bị chặn, không phải nhớ sửa lại.

Kiểm phiếu (xem tally) cũng chặn tương tự trong pha kỹ năng.

**Cách sửa đã chốt là tách hẳn thành 2 endpoint** — xem §13. Tách ra thì mỗi cửa tự khai báo đúng pha của mình, nên "danh sách cho phép" trở thành hệ quả tự nhiên chứ không phải một luật phải nhớ.

**Đừng quên cờ `canVoteNow`** trong endpoint cá nhân. Nó suy ra từ cùng bộ điều kiện, nên nếu chỉ sửa chỗ ghi phiếu mà quên chỗ này thì client vẫn hiện nút bỏ phiếu trong pha kỹ năng — bấm vào mới ăn lỗi. Trong pha kỹ năng, `canVoteNow` phải là **false với tất cả mọi người**.

---

## 6. API của Phù thuỷ

### 6.1. Ba endpoint mới

| Việc | Pha cho phép | Có cần chọn người không |
|---|---|---|
| **Đầu độc** | Chỉ ĐÊM | **Có** — client gửi id người bị độc |
| **Cứu** | Chỉ KỸ NĂNG | **Không** — mục tiêu luôn là nạn nhân của đêm, server tự xác định |
| **Xem lịch sử dùng thuốc** | Bất kỳ | Không |

Endpoint cứu **không nhận tham số mục tiêu**. Nếu để client gửi lên thì phải kiểm tra "có đúng là nạn nhân không" — thừa, và mở thêm một đường để client dò xem ai là nạn nhân bằng cách thử từng id. Server tự tính rồi tự ghi là kín hơn.

Đặt route riêng cho từng việc, theo đúng lối đã dùng cho Tiên tri và Bảo vệ.

### 6.2. Các trường hợp từ chối

Dùng chung cho cả hai bình, trừ chỗ ghi rõ:

| Tình huống | Mã |
|---|---|
| Ván không tồn tại | 404 |
| Ván đã kết thúc / bị huỷ | 409 |
| **Sai pha** (độc gọi ở pha kỹ năng, cứu gọi ở pha đêm…) | 409 |
| Không thuộc ván | 403 |
| Không phải Phù thuỷ | 403 |
| Phù thuỷ đã chết | 403 |
| **Bình thuốc đó đã dùng rồi** (xét cả ván) | 409 |
| *Cứu:* lượt này không có nạn nhân | 409 |
| *Độc:* mục tiêu không thuộc ván | 404 |
| *Độc:* mục tiêu đã chết | 409 |
| *Độc:* tự đầu độc mình | 400 |
| *Độc:* mục tiêu chính là người vừa được mình cứu | 400 (Quyết định #5) |

Dòng cuối chỉ xảy ra khi độc **sau** khi đã cứu trong cùng lượt. Nhưng theo §1 thì độc ở pha ĐÊM còn cứu ở pha KỸ NĂNG — tức là **độc luôn xảy ra trước cứu**. Nên thực tế phải chặn ở **chiều ngược lại**: khi gọi **cứu**, nếu nạn nhân chính là người mình vừa đầu độc trong lượt này thì từ chối. Đây là chỗ dễ cài nhầm chiều.

### 6.3. Phù thuỷ nhìn thấy gì

Qua endpoint cá nhân sẵn có, **chỉ dựng khi người gọi đúng là Phù thuỷ**:

| Thông tin | Ý nghĩa |
|---|---|
| **Bây giờ độc được không** | Đang pha ĐÊM · còn sống · ván đang chạy · còn thuốc độc · lượt này chưa độc |
| **Bây giờ cứu được không** | Đang pha KỸ NĂNG · còn sống · ván đang chạy · còn thuốc cứu · **có nạn nhân** · lượt này chưa cứu |
| **Nạn nhân của đêm nay** | **Chỉ trả trong pha KỸ NĂNG.** Rỗng nếu Sói hoà phiếu |
| Còn thuốc cứu không | Xét **cả ván** |
| Còn thuốc độc không | Xét **cả ván** |
| Lượt này đã cứu chưa | Để hiện lại đúng trạng thái sau khi tải lại trang |
| Lượt này đã độc ai | Như trên |

**Phải là hai cờ riêng, không gộp thành một.** Hai bình thuốc dùng ở hai pha khác nhau, nên một cờ chung "bây giờ làm được gì" sẽ luôn sai ở một trong hai pha.

**Nạn nhân chỉ trả trong pha KỸ NĂNG.** Trả ở pha NGÀY đồng nghĩa với tiết lộ **nguyên nhân chết** — xem §7.

### 6.4. Một điều Phù thuỷ suy ra được, và chấp nhận

Khi pha kỹ năng mở mà **không có nạn nhân**, Phù thuỷ biết được là **bầy Sói đã hoà phiếu** đêm đó. Không tránh được trong bất kỳ thiết kế nào cho cô ấy xem nạn nhân, và giá trị thông tin thấp (không chỉ ra ai là Sói). Chấp nhận.

Ngược lại, cô ấy **không** suy ra được việc Bảo vệ có che hay không — xem §8, đó mới là thứ phải giữ kín.

---

## 7. Không được rò rỉ gì

1. **Trạng thái ván tuyệt đối không chứa nạn nhân của đêm.** Lọt ra là cả làng biết Sói nhắm ai.
2. Khối thông tin của Phù thuỷ **chỉ dựng khi người gọi là Phù thuỷ** — vai khác không được có khoá đó, **kể cả rỗng**.
3. Lịch sử dùng thuốc lọc theo danh tính lấy từ **access token**, không theo tham số client gửi lên.
4. **Không phân biệt nguyên nhân chết cho người chơi.** Chết vì thuốc độc và chết vì Sói cắn phải nhìn giống nhau hoàn toàn. Lộ ra là Phù thuỷ bị suy ra trong một đêm.
5. **Không báo cho Phù thuỷ biết thuốc cứu có tác dụng hay không.** Nếu Bảo vệ đã che trúng thì thuốc thành vô ích — nhưng nói ra là tiết lộ hành động của Bảo vệ (§8).

---

## 8. Phù thuỷ xem nạn nhân "thô", chưa qua lọc của Bảo vệ

Ở bước 1 của §4.3, nạn nhân được tính **chỉ từ phiếu của Sói**. Phù thuỷ được cho xem đúng con số đó, **chưa trừ đi việc Bảo vệ có che hay không**.

Hai lý do:

- Nếu lọc trước rồi mới cho xem, thì khi Bảo vệ che trúng, Phù thuỷ sẽ thấy "không có nạn nhân" → cô ấy **suy ra được Bảo vệ vừa hành động**. Rò rỉ thông tin của vai khác.
- Đúng luật gốc: quản trò chỉ cho Phù thuỷ biết Sói nhắm ai, không nói người đó có được che hay không.

Hệ quả: Phù thuỷ có thể tiêu thuốc cứu vào người vốn đã được Bảo vệ cứu. Thuốc mất, và cô ấy **không được biết** là mất vô ích. Đó chính là điều cần giữ.

Vì Bảo vệ chỉ che được trong pha ĐÊM (§1), lúc Phù thuỷ xem nạn nhân thì việc che **đã chốt xong từ trước**. Không có chuyện hai bên tranh nhau. Nhưng vẫn **cố ý không lọc** trước khi cho xem, đúng vì hai lý do trên.

---

## 9. Cấu hình vai trò

| Số người | Sói | Dân | Bảo vệ | Tiên tri | **Phù thuỷ** | Có pha kỹ năng? |
|---|---|---|---|---|---|---|
| 6 | 1 | 4 | 1 | 0 | — | Không |
| 8 | 2 | 4 | 1 | 1 | — | Không |
| 10 | 2 | **5** | 1 | 1 | **1** | Có, **tới khi Phù thuỷ chết** |
| 15 | 3 | **9** | 1 | 1 | **1** | Có, **tới khi Phù thuỷ chết** |

Lấy bớt 1 Dân thường ở mốc 10 và 15, số Sói giữ nguyên.

> ⚠️ **Cân bằng:** mốc 10 người sẽ thành 2 Sói đối đầu 8 người phe Dân, trong đó **3 người có kỹ năng**. Thuốc độc lại còn giết thẳng được 1 con Sói. Phe Dân đang mạnh lên rất nhanh qua từng vai — nên chơi thử vài ván rồi mới tính tăng Sói. Xem §12 Quyết định #4.

---

## 10. Trường hợp biên

| Tình huống | Xử lý |
|---|---|
| Dùng cả 2 bình trong một đêm | Hợp lệ — 2 bản ghi khác loại |
| Gọi đầu độc trong pha KỸ NĂNG | Từ chối — thuốc độc chỉ dùng ở pha ĐÊM (§1) |
| Đầu độc đúng người Sói vừa cắn | Chết **một lần** — nhờ dùng tập hợp |
| Đã đầu độc X, tới pha kỹ năng thấy X chính là nạn nhân | Gọi cứu bị **từ chối** — chặn ở chiều này, xem §6.2 |
| Đầu độc người đang được Bảo vệ che | **Chết** — che chỉ chặn vết cắn |
| Bảo vệ che trúng, Phù thuỷ vẫn cứu | Không ai chết, **thuốc cứu mất**, và Phù thuỷ không được biết là mất vô ích |
| Sói hoà phiếu → không có nạn nhân | Không gọi được thuốc cứu. Thuốc độc vẫn dùng bình thường |
| Phù thuỷ chính là nạn nhân bị cắn | **Tự cứu được** — nạn nhân chính là cô ấy |
| **Phù thuỷ chết** | Từ lượt sau, pha kỹ năng **bị bỏ qua** — hợp lệ, vì vai người chết đã công khai (§2) |
| Phù thuỷ hết cả 2 bình nhưng còn sống | Pha kỹ năng **vẫn diễn ra** — không được bỏ, sẽ rò rỉ (§2) |
| Phù thuỷ chết đúng ở pha kỹ năng của lượt đó | Hành động đã ghi vẫn có hiệu lực; pha kỹ năng của lượt **sau** mới bị bỏ |
| Thuốc độc giết con Sói cuối cùng | Phe Dân thắng — nhờ xét thắng thua sau khi áp dụng hết cái chết |
| Đầu độc chính mình | Từ chối |
| Bỏ phiếu trong pha kỹ năng | Từ chối — **phải sửa code, xem §5** |
| Phù thuỷ chết ở pha NGÀY (bị treo cổ) | Lượt sau không còn pha kỹ năng |
| Ván không có Phù thuỷ ngay từ đầu (mốc 6, 8 người) | Không bao giờ có pha kỹ năng — vòng lượt y như hiện tại |
| Ván bị huỷ giữa chừng | Bản ghi hành động xoá theo ván |

---

## 11. Rủi ro kỹ thuật

### Rủi ro #1 — Hẹn giờ bắn trùng, giờ nguy hiểm hơn trước

Hàm chuyển pha hiện chỉ kiểm tra "ván còn đang chạy không", **không kiểm tra pha có khớp với cái hẹn giờ đã đặt**. Với 2 pha cùng thời lượng thì hậu quả nhẹ. Nhưng giờ 3 pha có thời lượng khác nhau, một hẹn giờ cũ bắn muộn sẽ **đẩy ván nhảy vọt một pha** — mất luôn lượt của Phù thuỷ, hoặc áp dụng cái chết sai thời điểm.

**Cần thêm chốt chặn:** đầu hàm chuyển pha, so thời điểm kết thúc pha đang lưu với hiện tại; còn ở tương lai thì bỏ qua vì nghĩa là pha đã được xử lý rồi. Rẻ, bịt đúng khe hở.

### Rủi ro #2 — Ràng buộc có điều kiện

Xem §3.2. Phải kiểm chứng thật với DB.

### Rủi ro #3 — Vòng lượt dài ngắn thay đổi giữa ván

Khi Phù thuỷ chết, lượt ngắn từ 135s xuống 120s. Client đếm ngược theo thời điểm kết thúc pha lấy từ server nên không sai, nhưng **client không được cứng hoá "một lượt luôn có 3 pha"** — phải đọc pha hiện tại từ server mỗi lần.

---

## 12. Quyết định — đã chốt

| # | Câu hỏi | Chốt |
|---|---|---|
| 1 | Kỹ năng nào dùng ở pha nào | **Tiên tri, Bảo vệ, thuốc độc → chỉ pha ĐÊM. Chỉ thuốc cứu ở pha KỸ NĂNG** |
| 2 | Thời lượng pha kỹ năng | **15 giây** |
| 3 | Cài "1 lần cả ván" | **Ràng buộc có điều kiện trên bảng hành động** — một nguồn sự thật duy nhất |
| 4 | Có tăng số Sói | **Không** — giữ nguyên, chơi thử rồi mới chỉnh |
| 5 | Vừa cứu vừa độc cùng một người | **Từ chối** |
| 6 | Tên pha mới | **Tên trung tính "pha kỹ năng"** — để dành cho vai sau, chứ Thợ săn không dùng |
| 7 | Bỏ phiếu | **Tách thành 2 endpoint riêng** — xem §13 |
| 8 | Thợ săn kích hoạt lúc nào | **Khai báo trước mục tiêu** — không cần pha riêng, xem §14 |

Đáp án #1 làm thiết kế **gọn hơn hẳn** bản trước: không phải nới kỹ năng nào ra hai cửa sổ, mỗi kỹ năng có đúng một pha, và pha kỹ năng chỉ phục vụ đúng một quyết định.

---

## 13. Tách API bỏ phiếu làm hai

Theo ý bạn ở §13 cũ: *"nên tách ra 2 api riêng, vote sói và vote giết người"*. **Đồng ý, và nó giải quyết thẳng lỗi ở §5.**

### Vì sao tách là đúng, không chỉ là gọn hơn

Endpoint bỏ phiếu hiện tại là **một cửa cho hai việc khác nhau**, phân biệt bằng cách đọc pha ở giữa thân hàm. Cấu trúc đó có một khuyết điểm cố hữu: nó **mặc định cho phép**. Luật duy nhất liên quan tới pha là *"nếu đang ĐÊM thì phải là Sói"*, nên **mọi pha chưa từng nghĩ tới đều tự động mở cổng**.

Đó chính là cách pha kỹ năng sẽ lọt lưới nếu không sửa (§5). Và nó sẽ lặp lại đúng như vậy với mọi pha thêm về sau.

Tách ra thì mỗi endpoint **tự khai báo đúng pha của mình**, không còn đường mặc định:

| Endpoint | Pha cho phép | Ai gọi được | Ý nghĩa |
|---|---|---|---|
| Bỏ phiếu **cắn** | Chỉ ĐÊM | Sói còn sống | Bầy Sói chọn nạn nhân |
| Bỏ phiếu **treo cổ** | Chỉ NGÀY | Mọi người còn sống | Cả làng xử một người |

Pha kỹ năng không nằm trong danh sách của endpoint nào → **tự động bị chặn**, không phải nhớ thêm luật gì.

### Được thêm mấy thứ

- **Thông báo lỗi đúng ngữ cảnh.** Giờ Dân gọi vào pha đêm nhận đúng "chỉ Sói được chọn nạn nhân ban đêm", không phải một lỗi chung mơ hồ.
- **Khớp với lối đặt route đã dùng cho các vai** (`seer/check`, `guardian/protect`) — mỗi hành động một cửa.
- **Kiểm phiếu cũng tách theo.** Kiểm phiếu cắn thì chỉ Sói xem được; kiểm phiếu treo cổ thì ai cũng xem được. Tách ra là hai luật hiển thị nằm ở hai chỗ riêng, không còn cành `if` lồng nhau.

### Cái giá

**Đây là thay đổi phá vỡ tương thích** với endpoint đang chạy. Client phải đổi: thay vì một cửa gọi ở cả hai pha, giờ gọi hai cửa tuỳ pha. Bù lại client cũng đỡ phải tự suy luận "giờ đang pha nào thì gọi được gì" — nó đọc `canVoteNow` từ endpoint cá nhân như hiện tại.

Nên làm việc tách này **trước** khi thêm pha kỹ năng (bước 3 của §15), vì lúc đó hành vi chưa đổi gì — chỉ là chia một cửa thành hai — nên dễ review và dễ quay lại nếu sai.

---

## 14. Trả lời câu hỏi về Thợ săn

> *"Ví dụ theo pha kỹ năng, nếu Thợ săn chết bởi Phù thuỷ thì Thợ săn sẽ chọn người chết cùng lúc nào?"*

Câu này chỉ ra đúng một chỗ mà pha kỹ năng **không giải quyết được**, và tôi nghĩ nó đủ quan trọng để chốt luôn từ giờ, kể cả khi chưa làm Thợ săn.

### Vì sao pha kỹ năng không đủ

Kỹ năng của Thợ săn kích hoạt **lúc chết**. Mà cái chết được áp dụng ở **cuối pha kỹ năng** (§4.3). Tới lúc đó thì pha kỹ năng đã đóng — không còn cửa sổ nào để Thợ săn chọn nữa.

```
pha KỸ NĂNG đang mở    →    pha KỸ NĂNG đóng
Thợ săn còn sống            Thợ săn vừa chết
"chưa cần bắn"              "giờ mới cần bắn, mà hết giờ rồi"
```

Nặng hơn: Thợ săn còn chết được ở **pha NGÀY** (bị treo cổ). Nên nếu giải bằng cách thêm cửa sổ phản ứng thì phải thêm ở **hai chỗ khác nhau** trong vòng lượt.

### Ba cách

| | Cách làm | Được | Mất |
|---|---|---|---|
| **A** | **Khai báo trước.** Thợ săn lúc còn sống tự chọn sẵn "nếu tôi chết thì bắn theo người này". Đổi được mỗi lượt như bỏ phiếu. Khi chết, người đó chết cùng | Không thêm pha nào. Xử lý **giống nhau** cho cả chết đêm và chết ngày. Không rò rỉ | Bắn mù — chọn trước khi biết mình sẽ chết |
| **B** | **Thêm cửa sổ phản ứng sau khi áp dụng cái chết**, chỉ mở khi vừa có Thợ săn chết | Đúng luật gốc nhất | Phải chèn được ở **hai** vị trí (sau pha kỹ năng và sau pha ngày) → máy trạng thái phức tạp hẳn lên. Và làm vòng lượt dài thêm bất thường |
| **C** | Bắn ngẫu nhiên | Không phải làm gì | Vô nghĩa với người chơi |

**Đề xuất A.** Nó giải quyết cả hai nguồn chết bằng cùng một cơ chế, không thêm pha, và vẫn giữ được sức nặng của vai: Sói phải e dè vì **không biết Thợ săn đang nhắm ai**, kể cả Thợ săn cũng không biết mình sẽ chết lúc nào.

Một điểm hay của A: nó khiến Thợ săn phải **liên tục cân nhắc lại** mỗi lượt xem nhắm ai — thành một quyết định chủ động suốt ván, chứ không phải một phản xạ duy nhất lúc chết.

### ✅ Đã chốt phương án A — những điều cần lưu ý khi làm

- Mục tiêu khai báo trước là **được đổi** (khác thuốc của Phù thuỷ) — vì chưa biết kết quả nên đổi ý không phá vỡ gì. Về bản chất nó giống **một lá phiếu** hơn là một kỹ năng dùng một lần.
- Lúc Thợ săn chết, nếu mục tiêu đã khai báo **cũng đã chết rồi** → phát bắn không thành, không tìm mục tiêu thay.
- Nếu chưa khai báo gì → không bắn.
- **Phản ứng dây chuyền:** Thợ săn A bắn trúng Thợ săn B, mà B cũng có mục tiêu khai báo sẵn → phải xử lý vòng lặp, và **dùng tập đã-xử-lý để chặn lặp vô hạn** (A nhắm B, B nhắm A).
- **Phát bắn phải được xử lý ở CẢ HAI nơi áp dụng cái chết**, không chỉ một:
  - §4.3 (chết ban đêm — do Sói cắn hoặc trúng độc)
  - §4.4 (chết ban ngày — bị treo cổ)

  Đây là chỗ dễ sót nhất. Nếu chỉ nối vào §4.3 thì Thợ săn bị treo cổ ban ngày sẽ **không bắn được** — mà treo cổ lại là cách Thợ săn hay chết nhất.
- Phát bắn **cộng vào cùng tập cái chết** của thời điểm đó, rồi mới xét thắng thua một lần — đúng nguyên tắc ở §4.3.

### Hệ quả cho quyết định #6

Tên trung tính "pha kỹ năng" vẫn giữ, nhưng **lý do đã khác**: không phải vì Thợ săn sẽ dùng lại pha này — Thợ săn không cần pha nào cả. Giữ tên trung tính chỉ để dành chỗ cho các vai sau, nếu sau này có vai nào cũng cần biết kết quả của đêm.

Và điều kiện bỏ qua pha ở §2 rút gọn còn đúng một câu: **pha kỹ năng diễn ra khi và chỉ khi Phù thuỷ còn sống.**

---

## 15. Thứ tự thực hiện

1. **Tách phần xử lý cái chết** thành 2 nhánh riêng cho đêm và ngày — refactor thuần, hành vi chưa đổi
2. **Thêm chốt chặn hẹn giờ** (Rủi ro #1) — chưa đổi hành vi
3. **Tách API bỏ phiếu làm hai** (§13) — chưa đổi hành vi vì hiện chỉ có 2 pha, nhưng là điều kiện tiên quyết để pha mới không lọt lưới
4. Thêm giá trị pha mới + bảng tra thời lượng theo pha (ĐÊM 60s · KỸ NĂNG 15s · NGÀY 60s)
5. Nối pha kỹ năng vào vòng lượt, **chỉ khi còn Phù thuỷ sống** (§2, §14)
6. Hai loại hành động mới + ràng buộc "1 lần cả ván" — **kiểm chứng ràng buộc với DB thật**
7. Thêm `witch` vào cấu hình vai (mốc 10 và 15)
8. Nghiệp vụ thuốc độc ở **pha ĐÊM** — giống Bảo vệ nhưng phạm vi cả ván và có giết người
9. Nghiệp vụ thuốc cứu ở **pha KỸ NĂNG** + nối vào §4.3
10. Khối thông tin của Phù thuỷ trong endpoint cá nhân + các route
11. Rà lại §7 — xác nhận nạn nhân của đêm không lọt ra ngoài
12. Tài liệu

**Bước 1–4 nên commit riêng trước khi đụng tới Phù thuỷ.** Chúng đổi cấu trúc vòng lượt, phần xử lý cái chết và API bỏ phiếu — trộn với logic vai mới thì rất khó review, mà đây đúng là chỗ dễ làm hỏng ván đấu nhất.

**Bước 11 không được bỏ qua** — compiler không bắt được loại lỗi này, phải chơi thật mới lộ, và lúc đó thì đã hỏng ván.

---

## 16. Cách kiểm chứng thủ công

1. Phòng **8 người** → vòng lượt **không có** pha kỹ năng, chạy y như trước.
2. Phòng **10 người** → có pha kỹ năng **15 giây** sau mỗi pha đêm.
3. Đêm 1: Sói cắn X. Trong pha kỹ năng, Phù thuỷ gọi endpoint cá nhân → thấy **đúng X là nạn nhân**.
3b. **Sói hoà phiếu** ở một đêm nào đó → pha kỹ năng vẫn mở, nạn nhân rỗng, gọi cứu bị từ chối.
3c. **Chính Phù thuỷ bị Sói cắn** → pha kỹ năng vẫn mở và cô ấy **tự cứu được mình** (§4.1).
4. Dùng thuốc cứu → sang pha ngày, **X vẫn sống**.
5. Tài khoản **khác** gọi endpoint cá nhân trong pha kỹ năng → **không thấy X**.
6. Tài khoản khác gọi trạng thái ván → **không có dấu vết nào** của nạn nhân.
7. **Thử bỏ phiếu (cả hai endpoint) trong pha kỹ năng → phải bị từ chối**, và endpoint cá nhân phải trả `canVoteNow = false` cho mọi người. Đây là bài dễ bỏ sót nhất.
8. Bỏ phiếu cắn vào **ban ngày** → từ chối. Bỏ phiếu treo cổ vào **ban đêm** → từ chối.
9. Đêm 2: gọi thuốc cứu lần nữa → từ chối (hết bình).
10. Đêm 2: đầu độc Y ở **pha đêm**, Sói cắn Z → sáng ra **cả Y và Z đều chết**.
11. Gọi thuốc độc trong **pha kỹ năng** → từ chối (thuốc độc thuộc pha đêm).
12. Đêm 3: đầu độc lần nữa → từ chối (hết bình).
13. Đầu độc chính mình → từ chối.
14. Đầu độc X ở pha đêm, rồi tới pha kỹ năng thấy chính X là nạn nhân → **gọi cứu phải bị từ chối** (Quyết định #5, và lưu ý chiều chặn ở §6.2).
15. Bảo vệ che W, Sói cắn W, Phù thuỷ cứu W → không ai chết, **và thuốc cứu vẫn bị tính là đã dùng**.
16. **Giết Phù thuỷ đi** → từ lượt sau pha kỹ năng **bị bỏ qua**, lượt ngắn lại còn 120s.
17. Phù thuỷ còn sống nhưng đã tiêu cả 2 bình → pha kỹ năng **vẫn phải diễn ra**.
18. Đầu độc con Sói cuối cùng → ván kết thúc ngay, phe Dân thắng.
