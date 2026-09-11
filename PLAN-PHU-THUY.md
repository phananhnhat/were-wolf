# Kế hoạch kỹ thuật — Vai Phù thuỷ (Witch)

Phù thuỷ có **2 bình thuốc, mỗi bình dùng đúng 1 lần trong cả ván**:

- **Thuốc cứu** — cứu người vừa bị Sói cắn trong đêm
- **Thuốc độc** — giết 1 người bất kỳ

**Đã chốt:** thêm **một pha mới** vào vòng lượt để Phù thuỷ **nhìn thấy ai bị Sói cắn** rồi mới quyết định. Bản kế hoạch mô tả logic, **không có code**.

Tham chiếu: [docs/game-rules.md §4](./docs/game-rules.md) (thứ tự hành động đêm), [docs/luat-choi.md §4.4](./docs/luat-choi.md), [docs/role-bao-ve.md](./docs/role-bao-ve.md), [docs/game-rounds.md](./docs/game-rounds.md) (vòng lượt hiện tại).

---

## 1. Vòng lượt mới

Hiện tại một lượt có 2 pha, mỗi pha 60 giây. Thêm pha **PHÙ THUỶ** vào giữa:

```
        ┌──────────────────── LƯỢT N (140 giây) ────────────────────┐
        │                                                            │
  ───►  │   ĐÊM  60s    →    PHÙ THUỶ  20s    →    NGÀY  60s        │  ───► LƯỢT N+1
        │   Sói cắn          Phù thuỷ quyết         cả làng          │
        │   Bảo vệ che       cứu / độc              treo cổ          │
        │   Tiên tri soi                                             │
        │        │                  │                     │          │
        └────────┼──────────────────┼─────────────────────┼──────────┘
                 ▼                  ▼                     ▼
        tính ra NẠN NHÂN     áp dụng TẤT CẢ         treo cổ người
        nhưng CHƯA giết      cái chết của đêm       nhiều phiếu nhất
        → cho Phù thuỷ xem   → xét thắng thua       → xét thắng thua
```

Điểm cốt lõi: **pha ĐÊM đóng lại thì chưa ai chết cả.** Nó chỉ *tính ra* nạn nhân rồi giữ lại đó. Toàn bộ cái chết của đêm được áp dụng ở cuối pha PHÙ THUỶ, sau khi Phù thuỷ đã quyết.

| Pha | Dài | Ai làm gì | Khi pha đóng |
|---|---|---|---|
| **ĐÊM** | 60s | Sói bỏ phiếu cắn, Bảo vệ che, Tiên tri soi | Kiểm phiếu Sói → ghi lại nạn nhân, **chưa giết** |
| **PHÙ THUỶ** | 20s | Chỉ Phù thuỷ. Xem nạn nhân, quyết cứu và/hoặc độc | Áp dụng hết cái chết → xét thắng thua |
| **NGÀY** | 60s | Cả làng bỏ phiếu treo cổ | Treo cổ → xét thắng thua → sang lượt mới |

Trong pha PHÙ THUỶ **không ai bỏ phiếu được**, kể cả Sói.

---

## 2. Vấn đề rò rỉ phải xử lý trước tiên

Đây là hệ quả không hiển nhiên của việc thêm pha, và nếu làm sai thì **hỏng hẳn vai Phù thuỷ**.

Phản xạ tự nhiên là: *"không có Phù thuỷ sống thì bỏ qua pha đó cho nhanh"*. **Không được làm vậy.** Mọi người chơi đều nhìn thấy pha hiện tại và đồng hồ đếm ngược. Nếu pha PHÙ THUỶ biến mất, cả làng biết ngay **Phù thuỷ đã chết**. Nếu nó xuất hiện lại thì lại biết là còn sống.

Tương tự với chuyện hết thuốc: bỏ qua pha khi đã dùng cả 2 bình là tiết lộ luôn **Phù thuỷ đã tiêu hết thuốc**.

### Cách xử lý

**Pha PHÙ THUỶ có hay không được quyết định một lần duy nhất, theo cấu hình vai của ván đó — và không bao giờ đổi trong suốt ván.**

| Ván | Có pha PHÙ THUỶ? |
|---|---|
| Cấu hình vai **có** Phù thuỷ (mốc 10, 15 người) | **Luôn có**, mọi lượt, kể cả khi Phù thuỷ đã chết hoặc hết cả 2 bình thuốc |
| Cấu hình vai **không có** Phù thuỷ (mốc 6, 8 người) | **Không bao giờ có** — vòng lượt giữ nguyên 2 pha như hiện tại |

Cách này không rò rỉ gì, vì **bảng cấu hình vai theo số người chơi là thông tin công khai** — ai cũng biết ván 10 người thì có Phù thuỷ. Cái bí mật là *cô ấy là ai* và *còn sống không*, và cả hai vẫn được giữ kín.

Cách nhận biết "ván này có Phù thuỷ": tra xem trong danh sách người chơi của ván có ai mang vai Phù thuỷ hay không. **Vai không bao giờ đổi trong ván**, nên câu trả lời cố định từ đầu tới cuối — không cần thêm cột nào để ghi nhớ.

> Cái giá phải trả: ván 10 và 15 người dài thêm 20 giây mỗi lượt, cả khi Phù thuỷ đã chết từ lâu. Đó là giá của việc không rò rỉ, và không có cách nào vòng qua.

---

## 3. Lưu ở đâu

### 3.1. Bảng `game_actions` — dùng chung, thêm 2 loại hành động

Bảng đã có sẵn cho Tiên tri và Bảo vệ. Thêm 2 giá trị vào danh sách loại hành động:

| Loại hành động | `targetId` | `result` |
|---|---|---|
| `WITCH_HEAL` | người được cứu = **chính nạn nhân bị Sói cắn** | không dùng |
| `WITCH_POISON` | người bị đầu độc | không dùng |

Điều này **giải quyết luôn một vướng mắc của phương án cũ**: trước đây thuốc cứu không có mục tiêu (Phù thuỷ quyết định mù), nên cột `targetId` đang `NOT NULL` bị vướng. Giờ Phù thuỷ nhìn thấy nạn nhân, nên bản ghi thuốc cứu có mục tiêu thật — **không phải đổi schema cột nào**.

### 3.2. Ràng buộc "mỗi bình 1 lần cả ván"

Ràng buộc hiện có trên bảng hành động là **theo từng đêm** (`ván + lượt + loại hành động + người dùng`). Nó đúng cho Tiên tri và Bảo vệ, nhưng **không chặn được** việc Phù thuỷ đêm 1 dùng thuốc độc rồi đêm 2 dùng tiếp.

Cần thêm một ràng buộc nữa, **bỏ "lượt" ra khỏi khoá** và chỉ áp cho 2 loại hành động của Phù thuỷ:

> Trong một ván, mỗi người chỉ được có **tối đa một** bản ghi `WITCH_HEAL`, và **tối đa một** bản ghi `WITCH_POISON`.

Hai ràng buộc cùng tồn tại, không đụng nhau — ràng buộc cũ vẫn lo cho các vai khác.

Nhờ vậy bảng hành động là **nguồn sự thật duy nhất** cho câu hỏi "còn thuốc không": chỉ cần xem đã có bản ghi loại đó trong ván này chưa, không quan tâm đêm nào.

> ⚠️ Ràng buộc có điều kiện (chỉ áp cho một số giá trị) là thứ `synchronize: true` xử lý không phải lúc nào cũng ổn định — có phiên bản TypeORM xoá rồi tạo lại mỗi lần khởi động. **Phải kiểm chứng thật khi có DB.** Nếu không ổn thì dùng phương án dự phòng ở §9 Quyết định #2.

### 3.3. Bảng `games` — thêm 1 cột để giữ nạn nhân đang chờ

Pha ĐÊM tính ra nạn nhân nhưng chưa giết, nên phải giữ lại thông tin đó qua pha PHÙ THUỶ.

Thêm một cột **nạn nhân đang chờ xử lý** (kiểu số, cho phép rỗng):

| Thời điểm | Giá trị |
|---|---|
| Đóng pha ĐÊM | ghi id người bị Sói cắn, hoặc để rỗng nếu Sói hoà phiếu / không ai bỏ phiếu |
| Trong pha PHÙ THUỶ | giữ nguyên — đây là thứ cho Phù thuỷ xem |
| Đóng pha PHÙ THUỶ | **xoá về rỗng** sau khi đã áp dụng cái chết |

Phải xoá về rỗng ở bước cuối. Để sót lại thì đêm sau đọc lên sẽ ra dữ liệu cũ.

### 3.4. Danh sách pha — thêm 1 giá trị

Cột pha của ván (và cột pha của bảng phiếu bầu, vì hai bảng dùng chung một kiểu liệt kê) cần thêm giá trị **PHÙ THUỶ**. Sẽ không bao giờ có phiếu bầu nào mang giá trị này — pha đó không ai bỏ phiếu.

### 3.5. Thời lượng pha

Hiện tại mọi pha dùng **một** hằng số 60 giây. Giờ có 2 thời lượng khác nhau, nên cần một bảng tra **thời lượng theo pha**: ĐÊM 60s, PHÙ THUỶ 20s, NGÀY 60s.

### 3.6. Không đụng tới

Bảng người chơi trong ván, bảng phiếu bầu — **không đổi cột nào, không đổi ràng buộc nào**.

---

## 4. Logic từng thời điểm

### 4.1. Đóng pha ĐÊM

```
1. Kiểm phiếu của Sói trong đêm nay
2. Chọn người bị nhiều phiếu nhất
      hoà phiếu / không ai bỏ phiếu  →  không có nạn nhân
3. Ghi id người đó vào "nạn nhân đang chờ" trên bản ghi ván
      ── KHÔNG giết ai
      ── KHÔNG xét điều kiện thắng (vì chưa ai chết)
      ── KHÔNG xét việc Bảo vệ có che hay không (xem ghi chú dưới)
4. Nếu ván này CÓ pha Phù thuỷ  →  mở pha PHÙ THUỶ
   Nếu KHÔNG                     →  áp dụng cái chết ngay như hiện tại, rồi mở pha NGÀY
```

**Ghi chú quan trọng — chưa xét Bảo vệ ở bước này.** Phù thuỷ được cho xem **nạn nhân thô mà Sói nhắm tới**, chưa qua lọc của Bảo vệ. Có hai lý do:

- Nếu lọc trước rồi mới cho xem, thì khi Bảo vệ che trúng, Phù thuỷ sẽ thấy "không có nạn nhân" → cô ấy **suy ra được Bảo vệ vừa hành động**. Rò rỉ thông tin của vai khác.
- Đúng với luật gốc: quản trò chỉ cho Phù thuỷ biết Sói nhắm ai, không nói người đó có được che hay không.

Hệ quả: Phù thuỷ có thể tiêu thuốc cứu vào một người vốn đã được Bảo vệ cứu. Thuốc mất, nhưng cô ấy **không biết** là đã mất vô ích — và đó chính là điều cần giữ.

### 4.2. Trong pha PHÙ THUỶ

Chỉ Phù thuỷ còn sống làm được việc, và làm được 2 việc **độc lập nhau**:

| Hành động | Điều kiện | Ghi nhận |
|---|---|---|
| **Cứu** | Còn thuốc cứu, **và đêm nay có nạn nhân** | Bản ghi `WITCH_HEAL` với mục tiêu = nạn nhân đang chờ |
| **Độc** | Còn thuốc độc, mục tiêu còn sống và không phải chính mình | Bản ghi `WITCH_POISON` với mục tiêu đã chọn |

Được dùng **cả hai trong cùng một đêm**. Mỗi hành động **ghi một lần, không rút lại, không đổi mục tiêu** — giống Tiên tri và Bảo vệ.

Nếu đêm nay **không có nạn nhân** thì không gọi được thuốc cứu (từ chối). Đây là cải thiện rõ so với phương án mù trước đây: Phù thuỷ **nhìn thấy** là không có ai để cứu, nên không thể tiêu thuốc vô ích.

Mọi vai khác gọi vào pha này đều bị từ chối. Bỏ phiếu trong pha này cũng bị từ chối.

### 4.3. Đóng pha PHÙ THUỶ — nơi áp dụng toàn bộ cái chết

Đây là phần lõi, và là chỗ **dễ gây lỗi ván đấu nhất**:

```
deaths = TẬP HỢP rỗng        ← dùng TẬP, vì 1 người có thể trúng cả 2 nguồn

── Nguồn 1: Sói cắn ──────────────────────────────────────
nạn nhân = "nạn nhân đang chờ" trên bản ghi ván
nếu có nạn nhân:
     nếu Bảo vệ che đúng người đó        →  sống, bỏ qua
     ngược lại, nếu có bản ghi thuốc cứu →  sống, bỏ qua
     ngược lại                           →  deaths += nạn nhân

── Nguồn 2: thuốc độc ────────────────────────────────────
nếu có bản ghi thuốc độc đêm nay:
     deaths += mục tiêu của nó
     ── Bảo vệ KHÔNG chặn được thuốc độc
     ── thuốc cứu KHÔNG cứu được người trúng độc

── Áp dụng ───────────────────────────────────────────────
đánh dấu tất cả người trong deaths là đã chết
xoá "nạn nhân đang chờ" về rỗng
xét điều kiện thắng MỘT LẦN DUY NHẤT
     thắng  →  kết thúc ván, dừng
     chưa   →  mở pha NGÀY
```

**Hai điều bắt buộc:**

1. **Dùng tập hợp, không phải danh sách.** Phù thuỷ hoàn toàn có thể đầu độc đúng người mà Sói vừa cắn. Nếu cộng dồn thì sẽ xử lý cái chết hai lần.

2. **Xét điều kiện thắng đúng một lần, sau khi đã áp dụng hết cái chết.** Xét sau từng cái chết là sai: ví dụ thuốc độc giết con Sói cuối cùng, đồng thời Sói cũng vừa cắn chết một Dân — kết quả ván sẽ **phụ thuộc thứ tự xử lý**, hôm nay Dân thắng mai lại Sói thắng.

### 4.4. Đóng pha NGÀY

Không đổi so với hiện tại: kiểm phiếu cả làng, treo cổ người nhiều phiếu nhất, xét thắng thua, tăng số lượt, mở pha ĐÊM.

**Không** áp dụng che của Bảo vệ, **không** áp dụng thuốc men gì — cả hai chỉ có tác dụng ban đêm.

---

## 5. Phù thuỷ nhìn thấy gì

Qua endpoint cá nhân sẵn có, và **chỉ dựng khi người gọi đúng là Phù thuỷ** — giống cách Tiên tri và Bảo vệ đang làm:

| Thông tin | Ý nghĩa |
|---|---|
| Bây giờ có làm được gì không | Đang ở pha PHÙ THUỶ, còn sống, ván đang chạy |
| **Nạn nhân đêm nay là ai** | **Chỉ hiện trong pha PHÙ THUỶ.** Rỗng nếu Sói hoà phiếu |
| Còn thuốc cứu không | Xét trên **cả ván** |
| Còn thuốc độc không | Xét trên **cả ván** |
| Đêm nay đã cứu chưa | Để hiện lại đúng trạng thái sau khi tải lại trang |
| Đêm nay đã độc ai | Như trên |

Hai trường "còn thuốc" xét cả ván; hai trường "đêm nay" xét lượt hiện tại. Nhờ vậy Phù thuỷ F5 hay đổi máy vẫn thấy đúng trạng thái, không mất thông tin.

**Nạn nhân chỉ được trả trong pha PHÙ THUỶ.** Ngoài pha đó thì không, vì để lộ ở pha NGÀY đồng nghĩa với tiết lộ **nguyên nhân chết** — xem §6.

---

## 6. Không được rò rỉ gì

Ba nguyên tắc đã áp cho Tiên tri và Bảo vệ, giữ nguyên:

1. **Trạng thái ván tuyệt đối không chứa "nạn nhân đang chờ".** Cột mới ở §3.3 chỉ dùng nội bộ và cho riêng Phù thuỷ. Lọt ra là cả làng biết Sói nhắm ai.
2. Khối thông tin của Phù thuỷ **chỉ dựng khi người gọi là Phù thuỷ**. Vai khác không được có khoá đó, **kể cả rỗng** — sự tồn tại của khoá cũng là tín hiệu.
3. Lịch sử dùng thuốc lọc theo danh tính lấy từ **access token**, không theo tham số client gửi lên.

Thêm hai điều riêng của vai này:

4. **Không phân biệt nguyên nhân chết cho người chơi.** Chết vì thuốc độc và chết vì Sói cắn phải nhìn giống nhau hoàn toàn. Nếu lộ, Phù thuỷ bị suy ra chỉ trong một đêm.
5. **Không báo cho Phù thuỷ biết thuốc cứu có phát huy tác dụng hay không.** Nếu Bảo vệ đã che trúng, thuốc cứu thành vô ích — nhưng nói ra là tiết lộ hành động của Bảo vệ (§4.1).

> Điểm 4 là lý do mục "phân biệt nguyên nhân chết" ([PLAN.md §8.2](./PLAN.md)) phải làm cẩn thận: nguyên nhân chết cần cho **nhật ký nội bộ** và cho các vai sau này, nhưng **không phải thứ công khai**.

---

## 7. Cấu hình vai trò

| Số người | Sói | Dân | Bảo vệ | Tiên tri | **Phù thuỷ** | Có pha PHÙ THUỶ? |
|---|---|---|---|---|---|---|
| 6 | 1 | 4 | 1 | 0 | — | Không |
| 8 | 2 | 4 | 1 | 1 | — | Không |
| 10 | 2 | **5** | 1 | 1 | **1** | **Có** |
| 15 | 3 | **9** | 1 | 1 | **1** | **Có** |

Lấy bớt 1 Dân thường ở mốc 10 và 15, số Sói giữ nguyên.

> ⚠️ **Cân bằng:** mốc 10 người sẽ thành 2 Sói đối đầu 8 người phe Dân, trong đó **3 người có kỹ năng**. Thuốc độc lại còn giết thẳng được 1 con Sói. Phe Dân đang mạnh lên rất nhanh qua từng vai. Nên chơi thử vài ván rồi mới tính tăng Sói — xem §9 Quyết định #4.

---

## 8. Trường hợp biên

| Tình huống | Xử lý |
|---|---|
| Dùng cả 2 bình trong một đêm | Hợp lệ — 2 bản ghi khác loại, ràng buộc tính theo từng loại |
| Đầu độc đúng người Sói vừa cắn | Chết **một lần** — nhờ dùng tập hợp |
| Cứu nạn nhân **và** đầu độc chính nạn nhân đó | Vô lý, chắc chắn bấm nhầm → **từ chối**. Xem Quyết định #3 |
| Đầu độc người đang được Bảo vệ che | **Chết** — che chỉ chặn vết cắn |
| Bảo vệ đã che trúng, Phù thuỷ vẫn cứu | Không ai chết, **thuốc cứu mất** — và Phù thuỷ không được biết là mất vô ích |
| Sói hoà phiếu → không có nạn nhân | Không gọi được thuốc cứu (từ chối). Thuốc độc vẫn dùng được bình thường |
| Phù thuỷ chính là nạn nhân bị cắn | **Tự cứu được** — thuốc cứu nhắm vào nạn nhân, mà nạn nhân là cô ấy |
| Phù thuỷ đã chết | Pha PHÙ THUỶ **vẫn diễn ra đủ 20 giây** (§2), nhưng mọi hành động bị từ chối |
| Phù thuỷ hết cả 2 bình | Pha **vẫn diễn ra đủ 20 giây** (§2) |
| Thuốc độc giết con Sói cuối cùng | Phe Dân thắng — nhờ xét thắng thua **sau khi** áp dụng hết cái chết |
| Đầu độc chính mình | Từ chối |
| Bỏ phiếu trong pha PHÙ THUỶ | Từ chối — pha này không ai bỏ phiếu |
| Ván bị huỷ giữa chừng | Bản ghi hành động xoá theo ván |

---

## 9. Rủi ro kỹ thuật và quyết định còn lại

### Rủi ro #1 — Hẹn giờ bắn trùng giờ nguy hiểm hơn trước

Hiện tại hàm chuyển pha chỉ kiểm tra "ván còn đang chạy không", **không kiểm tra pha có khớp với cái hẹn giờ đã đặt hay không**. Với 2 pha cùng thời lượng thì hậu quả nhẹ. Nhưng giờ 3 pha có thời lượng khác nhau, một cái hẹn giờ cũ bắn muộn sẽ **đẩy ván nhảy vọt một pha** — mất luôn lượt của Phù thuỷ, hoặc áp dụng cái chết sai thời điểm.

**Cần thêm chốt chặn:** đầu hàm chuyển pha, so thời điểm kết thúc pha đang lưu với hiện tại; nếu còn ở tương lai thì bỏ qua, vì nghĩa là pha đã được xử lý rồi. Rẻ, và bịt đúng khe hở này.

### Rủi ro #2 — Ràng buộc có điều kiện

Xem cảnh báo ở §3.2. Phải kiểm chứng thật với DB.

### Quyết định #1 — Thời lượng pha PHÙ THUỶ

Đề xuất **20 giây**. Phù thuỷ cần đọc xem ai là nạn nhân, quyết có cứu không, và nếu độc thì còn phải chọn người trong danh sách. 15 giây hơi gấp, 30 giây thì làm cả làng chờ vô ích ở những lượt Phù thuỷ không làm gì.

### Quyết định #2 — Nếu ràng buộc có điều kiện không chạy được

- **A. Ràng buộc có điều kiện** (đề xuất) — một nguồn sự thật duy nhất
- B. Thêm 2 cột đánh dấu "đã dùng thuốc cứu" / "đã dùng thuốc độc" vào bảng người chơi trong ván — chắc chắn chạy, nhưng state bị nhân đôi và phải tự giữ cho đồng bộ với bảng hành động

### Quyết định #3 — Vừa cứu vừa đầu độc cùng một người

- **A. Từ chối** (đề xuất) — chắc chắn là bấm nhầm, chặn sớm cho người chơi khỏi mất oan cả 2 bình
- B. Cho phép, thuốc độc thắng — đúng về logic tập hợp nhưng vô nghĩa trong game

### Quyết định #4 — Có tăng số Sói không

- **A. Giữ nguyên** (đề xuất) — đổi một thứ tại một thời điểm, chơi thử rồi mới chỉnh
- B. Tăng lên 3 Sói ở mốc 10 người ngay

### Quyết định #5 — Tên của pha mới

- **A. Đặt tên theo vai** (đề xuất) — đọc code hiểu ngay. Không rò rỉ gì vì cấu hình vai là công khai
- B. Đặt tên trung tính kiểu "xử lý đêm" — để sau này Thợ săn (cần một cửa sổ tương tự lúc chết) dùng lại được cùng một pha

---

## 10. Thứ tự thực hiện

1. **Tách phần xử lý cái chết** hiện tại thành 2 nhánh riêng cho đêm và ngày — refactor thuần, hành vi chưa đổi
2. **Thêm chốt chặn hẹn giờ** ở Rủi ro #1 — cũng chưa đổi hành vi
3. Thêm giá trị pha mới + bảng tra thời lượng theo pha
4. Cột "nạn nhân đang chờ"; đổi việc đóng pha ĐÊM thành *tính rồi giữ lại*, chưa giết
5. Nối pha PHÙ THUỶ vào vòng lượt, **có điều kiện theo cấu hình vai của ván** (§2)
6. Hai loại hành động mới + ràng buộc "1 lần cả ván" — **kiểm chứng ràng buộc với DB thật**
7. Thêm `witch` vào cấu hình vai
8. Nghiệp vụ thuốc độc (dễ hơn, giống Bảo vệ nhưng phạm vi cả ván và có giết người)
9. Nghiệp vụ thuốc cứu + nối vào phần áp dụng cái chết ở §4.3
10. Khối thông tin của Phù thuỷ trong endpoint cá nhân + các route
11. Rà lại §6 — đọc kỹ trạng thái ván và kiểm phiếu, xác nhận không lọt "nạn nhân đang chờ" ra ngoài
12. Tài liệu

**Bước 1–4 nên commit riêng trước khi đụng tới Phù thuỷ.** Chúng đổi cấu trúc vòng lượt và phần xử lý cái chết — trộn với logic vai mới thì rất khó review, mà đây đúng là chỗ dễ làm hỏng ván đấu nhất.

**Bước 11 không được bỏ qua** — loại lỗi này compiler không bắt được, phải chơi thật mới lộ, và lúc đó thì đã hỏng ván.

---

## 11. Cách kiểm chứng thủ công

1. Tạo phòng **8 người** → vòng lượt phải **không có** pha PHÙ THUỶ, chạy y như trước.
2. Tạo phòng **10 người** → phải có pha PHÙ THUỶ 20 giây sau mỗi pha đêm.
3. Đêm 1: Sói cắn X. Trong pha PHÙ THUỶ, gọi endpoint cá nhân bằng tài khoản Phù thuỷ → phải thấy **đúng X là nạn nhân**.
4. Dùng thuốc cứu → sang pha NGÀY, **X vẫn sống**.
5. Gọi endpoint cá nhân bằng tài khoản **khác** trong pha PHÙ THUỶ → **không được thấy X là nạn nhân**.
6. Gọi trạng thái ván bằng tài khoản khác → **không có dấu vết nào** của nạn nhân đang chờ.
7. Đêm 2: gọi thuốc cứu lần nữa → **từ chối** (hết bình).
8. Đêm 2: đầu độc Y, đồng thời Sói cắn Z → sáng ra **cả Y và Z đều chết** (2 người chết trong một đêm).
9. Đêm 3: đầu độc lần nữa → **từ chối**.
10. Đầu độc chính mình → từ chối. Bỏ phiếu trong pha PHÙ THUỶ → từ chối.
11. Bảo vệ che W, Sói cắn W, Phù thuỷ cứu W → không ai chết, **và thuốc cứu bị tính là đã dùng**.
12. Giết Phù thuỷ đi, chơi tiếp → pha PHÙ THUỶ **vẫn phải diễn ra đủ 20 giây** mỗi lượt.
13. Đầu độc con Sói cuối cùng → ván kết thúc ngay, **phe Dân thắng**.
