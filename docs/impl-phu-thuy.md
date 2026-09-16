# Tài liệu triển khai — Pha kỹ năng & vai Phù thuỷ

**Trạng thái: đã code xong (2026-09-15), theo đúng thứ tự ở §4.** Ghi chú lệch/phát sinh so với kế hoạch: xem §8 cuối tài liệu.

Tài liệu ở mức **thiết kế thi công**: dữ liệu cần đổi gì, luồng xử lý cần bổ sung gì, làm theo thứ tự nào. Không đi vào tên file hay tên hàm.

Luật chơi và lý do thiết kế: [PLAN-PHU-THUY.md](../PLAN-PHU-THUY.md).

---

## 1. Soát lại logic nghiệp vụ

Đã rà một lượt trước khi thi công. **Không còn lỗ hổng nào chặn việc làm.** Hai điều ghi lại:

### 1.1. Đã kiểm tra và loại trừ: hai phe cùng bị xoá sổ trong một đêm

Phù thuỷ là vai đầu tiên khiến **một đêm chết được 2 người**, nên cần kiểm tra xem có sinh ra thế bí "cả hai phe cùng về 0" không — luật thắng thua hiện tại xét "hết Sói → Dân thắng" **trước**, nên nếu cả hai cùng về 0 thì phe Dân thắng dù đã chết sạch.

**Kết luận: không xảy ra được với riêng Phù thuỷ.** Muốn về 0-0 thì trước đêm đó phải còn đúng 1 Sói và 1 Dân — mà trạng thái đó đã thoả điều kiện Sói thắng và ván kết thúc từ trước rồi. Hai cái chết một đêm không đủ với tới.

> ⚠️ **Nhưng sẽ với tới được khi có Thợ săn**, vì lúc đó một đêm chết được 3 người: từ 1 Sói + 2 Dân, Sói cắn chết Dân A → A là Thợ săn bắn chết Dân B → Phù thuỷ độc chết Sói → **0 Sói, 0 Dân**. Khi làm Thợ săn phải chốt luật cho thế này: hoà, hay Dân thắng.

### 1.2. Luật "Sói không cắn Sói" — đã xử lý

Trước đây Sói vẫn bỏ phiếu cắn được đồng đội, kéo theo chuyện vô lý là Phù thuỷ có thể dùng thuốc cứu để cứu một con Sói. **Đã cấm** (ban đêm, mục tiêu không được là Sói; ban ngày vẫn treo cổ được bất kỳ ai). Không còn vướng gì cho Phù thuỷ.

---

## 2. Thay đổi dữ liệu

**Không thêm bảng mới. Không thêm cột nào.** Toàn bộ dữ liệu của Phù thuỷ nằm gọn trong bảng hành động đã có sẵn từ hồi làm Tiên tri và Bảo vệ.

### 2.1. Danh sách pha — thêm một giá trị

Hiện có `ĐÊM` và `NGÀY`. Thêm giá trị thứ ba cho **pha kỹ năng**, đặt tên trung tính (không gắn với vai Phù thuỷ) để dành cho các vai sau.

Đây là kiểu liệt kê **dùng chung** bởi trạng thái ván và bảng phiếu bầu. Thêm giá trị là thao tác an toàn, không mất dữ liệu. Sẽ không bao giờ có phiếu bầu nào mang giá trị này vì pha đó không ai bỏ phiếu.

### 2.2. Bảng hành động — thêm 2 loại và 1 ràng buộc

**Hai loại hành động mới:** dùng thuốc cứu, dùng thuốc độc. Cả hai dùng đúng các cột sẵn có:

| Loại | Lượt | Mục tiêu | Kết quả |
|---|---|---|---|
| Thuốc cứu | lượt dùng | id nạn nhân bị Sói cắn | không dùng |
| Thuốc độc | lượt dùng | id người bị độc | không dùng |

Cột mục tiêu hiện **bắt buộc có giá trị** — không phải nới lỏng, vì cả hai loại đều có mục tiêu thật. (Đây là cái lợi của việc cho Phù thuỷ nhìn thấy nạn nhân: nếu để cô ấy quyết định mù thì thuốc cứu sẽ không có mục tiêu và phải sửa cột.)

**Một ràng buộc mới.** Ràng buộc hiện có là *"mỗi người, mỗi loại hành động, mỗi lượt chỉ một lần"* — đúng cho Tiên tri và Bảo vệ. Phù thuỷ cần *"mỗi bình một lần trong **cả ván**"*, tức là phải **bỏ yếu tố lượt ra khỏi khoá**, và chỉ áp cho 2 loại của Phù thuỷ.

Hai ràng buộc cùng tồn tại, không đụng nhau. Nhờ vậy bảng hành động vẫn là **nguồn sự thật duy nhất** cho câu hỏi "còn thuốc không" — không cần cột trạng thái riêng.

> ⚠️ Ràng buộc có điều kiện (chỉ áp cho một số giá trị) là chỗ cơ chế tự đồng bộ schema xử lý **không ổn định** ở một số phiên bản — có bản xoá rồi tạo lại index mỗi lần khởi động. **Phải kiểm chứng thật với DB trước khi đi tiếp.** Xem §5.

### 2.3. Cấu hình vai theo số người

| Mốc | Đổi gì |
|---|---|
| 6 · 8 người | Không đổi — không có Phù thuỷ |
| 10 người | Bớt 1 Dân thường, thêm 1 Phù thuỷ |
| 15 người | Bớt 1 Dân thường, thêm 1 Phù thuỷ |

Số Sói giữ nguyên. Việc chia vai đọc thẳng từ bảng cấu hình rồi xáo trộn nên **không phải sửa gì**.

### 2.4. Thời lượng pha

Hiện mọi pha dùng **chung một** thời lượng 60 giây. Giờ cần **tra theo pha**: đêm 60s, kỹ năng 15s, ngày 60s.

---

## 3. Logic cần bổ sung

### 3.1. Vòng lượt: từ 2 pha cố định sang 3 pha có điều kiện

Hiện việc chuyển pha là một phép lật đơn giản: đêm ↔ ngày, tăng lượt khi về đêm.

Logic mới:

| Đóng pha | Làm gì |
|---|---|
| **ĐÊM** | **Không giết ai, không xét thắng thua.** Chỉ đóng cổng bỏ phiếu. Phù thuỷ còn sống → mở pha kỹ năng; không còn → xử lý cái chết ngay tại đây rồi mở ngày |
| **KỸ NĂNG** | Xử lý toàn bộ cái chết của đêm → xét thắng thua → mở ngày |
| **NGÀY** | Treo cổ → xét thắng thua → **tăng lượt** → mở đêm |

Hai điểm bất biến phải giữ:

- **Bộ đếm lượt vẫn chỉ tăng ở đúng một chỗ: khi đóng pha ngày.** Nhờ vậy đêm / kỹ năng / ngày của cùng một lượt mang cùng số lượt, và mọi truy vấn theo lượt không phải trừ lùi gì.
- **Điều kiện "Phù thuỷ còn sống" xét TRƯỚC khi áp dụng cái chết của đêm đó.** Nên nếu chính Phù thuỷ bị cắn, pha kỹ năng vẫn mở và cô ấy vẫn kịp tự cứu. Xét sau thì cô ấy chết trước khi kịp phản ứng.

Và **không được** xét thêm điều kiện "còn thuốc hay không" — bỏ pha vì hết thuốc là rò rỉ.

### 3.2. Xử lý cái chết: từ "tối đa 1 người" sang "một tập người"

Hiện phần xử lý cuối pha dùng chung cho cả đêm lẫn ngày, và **giả định tối đa một người chết**. Thuốc độc phá vỡ giả định đó.

Cần tách thành hai nhánh vì giờ chúng thực sự khác nhau:

**Nhánh ban đêm** — gom từ 2 nguồn vào **một tập hợp**:

```
Nguồn 1 — Sói cắn:
    kiểm phiếu Sói của lượt này → nạn nhân (hoà phiếu thì không có ai)
    nạn nhân được Bảo vệ che?      → sống
    hoặc có dùng thuốc cứu?        → sống
    ngược lại                       → vào tập chết

Nguồn 2 — thuốc độc:
    có dùng thuốc độc lượt này?    → mục tiêu vào tập chết
    (Bảo vệ KHÔNG chặn, thuốc cứu KHÔNG cứu)
```

**Nhánh ban ngày** — giữ nguyên như hiện tại: treo cổ người nhiều phiếu nhất, không áp dụng che hay thuốc men gì.

Ba điều bắt buộc:

1. **Dùng tập hợp, không phải danh sách.** Phù thuỷ độc trúng đúng người Sói vừa cắn là chuyện có thật — cộng dồn thì xử lý cái chết hai lần.
2. **Xét thắng thua đúng một lần, sau khi áp dụng hết cái chết.** Xét sau từng người là sai: thuốc độc giết con Sói cuối cùng trong khi Sói cũng vừa cắn chết một Dân — kết quả ván sẽ phụ thuộc thứ tự xử lý.
3. **Nạn nhân được tính lại từ bảng phiếu**, không lưu ở đâu cả. Pha đêm đóng là đóng luôn cổng bỏ phiếu, nên bảng phiếu của lượt đó đã đóng băng, tính bao nhiêu lần cũng ra một đáp án.

### 3.3. Bỏ phiếu: đổi từ "mặc định cho phép" sang "danh sách cho phép"

Đây là chỗ **sẽ sinh lỗi nếu không sửa trước**.

Hiện việc bỏ phiếu là **một cửa cho hai việc khác nhau** (Sói cắn và cả làng treo cổ), phân biệt bằng cách đọc pha ở giữa. Luật duy nhất liên quan tới pha là *"nếu đang đêm thì phải là Sói"* — nghĩa là **mọi pha chưa từng nghĩ tới đều tự động mở cổng**.

Thêm pha kỹ năng vào mà không sửa thì **cả làng sẽ bỏ phiếu treo cổ được ngay trong pha đó**.

Cần **tách làm hai đường riêng**, mỗi đường tự khai báo đúng pha của mình:

| Đường | Pha | Ai |
|---|---|---|
| Bỏ phiếu cắn | chỉ ban đêm | Sói còn sống |
| Bỏ phiếu treo cổ | chỉ ban ngày | mọi người còn sống |

Pha kỹ năng không nằm trong danh sách nào → tự động bị chặn. Các pha thêm về sau cũng vậy, không phải nhớ thêm luật.

Việc xem kiểm phiếu tách tương tự: phiếu cắn chỉ Sói xem được, phiếu treo cổ ai cũng xem được.

**Đừng quên cờ "bây giờ bỏ phiếu được không"** trong thông tin cá nhân. Nó suy ra từ cùng bộ điều kiện — sửa chỗ ghi phiếu mà quên cờ này thì client vẫn hiện nút bỏ phiếu trong pha kỹ năng, bấm vào mới ăn lỗi.

### 3.4. Kiểm tra quyền dùng kỹ năng: nới ra 2 chiều

Phần kiểm tra chung cho kỹ năng ban đêm (đã tách ra từ hồi làm Bảo vệ) hiện **cứng hoá hai thứ** mà Phù thuỷ không khớp:

| Cứng hoá | Hiện tại | Cần thành |
|---|---|---|
| Pha được dùng | luôn là ban đêm | tra theo từng loại kỹ năng |
| Phạm vi "đã dùng chưa" | luôn theo lượt | theo lượt **hoặc** cả ván |

Nới cả hai thành tham số. Tiên tri và Bảo vệ truyền vào đúng giá trị cũ nên hành vi không đổi.

### 3.5. Hai kỹ năng mới

| Kỹ năng | Pha | Phạm vi | Luật riêng |
|---|---|---|---|
| **Thuốc độc** | ban đêm | cả ván | Mục tiêu còn sống, không phải chính mình |
| **Thuốc cứu** | pha kỹ năng | cả ván | Lượt này **phải có nạn nhân**; nạn nhân không được là người mình vừa độc |

**Thuốc cứu không nhận mục tiêu từ client.** Mục tiêu luôn là nạn nhân của đêm, server tự tính rồi tự ghi. Để client gửi lên thì vừa thừa, vừa mở một đường để dò xem ai là nạn nhân bằng cách thử từng id.

**Chiều chặn "vừa cứu vừa độc cùng một người"**: vì độc dùng ở pha đêm còn cứu ở pha kỹ năng, **độc luôn xảy ra trước**. Nên phép kiểm phải nằm ở **lúc gọi cứu** (nạn nhân có trùng người mình vừa độc không), chứ không phải lúc gọi độc. Đây là chỗ dễ cài ngược chiều.

Cả hai vẫn giữ hai tầng chặn như các vai trước: hỏi trước cho thông báo dễ hiểu, và ràng buộc ở tầng dữ liệu để bịt khe hở giữa lúc kiểm tra và lúc ghi.

### 3.6. Thông tin riêng của Phù thuỷ

Bổ sung vào chỗ trả thông tin cá nhân, **chỉ dựng khi người gọi đúng là Phù thuỷ** — giống cách Tiên tri và Bảo vệ đang làm:

| Thông tin | Tính từ |
|---|---|
| Bây giờ **độc** được không | đang ban đêm · còn sống · ván đang chạy · còn thuốc độc · lượt này chưa độc |
| Bây giờ **cứu** được không | đang pha kỹ năng · còn sống · ván đang chạy · còn thuốc cứu · **lượt này có nạn nhân** · chưa cứu |
| **Nạn nhân của đêm nay** | **Chỉ trả trong pha kỹ năng**, ngoài ra luôn rỗng |
| Còn thuốc cứu / thuốc độc | xét cả ván |
| Lượt này đã cứu chưa / đã độc ai | xét theo lượt, để tải lại trang không mất trạng thái |

**Phải là hai cờ riêng cho hai bình, không gộp một** — vì hai bình dùng ở hai pha khác nhau nên một cờ chung sẽ luôn sai ở một trong hai pha.

### 3.7. Ba đường mới cho client

Dùng thuốc độc (có chọn người) · dùng thuốc cứu (không có tham số) · xem lịch sử dùng thuốc của chính mình.

Cộng với việc **tách đôi đường bỏ phiếu** ở §3.3 — đây là **thay đổi phá vỡ tương thích** với client hiện tại, nên làm ở bước riêng trước khi đụng Phù thuỷ.

---

## 4. Thứ tự làm

| # | Việc | Đổi hành vi? |
|---|---|---|
| 1 | Tách xử lý cái chết thành 2 nhánh, đổi sang trả về **tập người** (§3.2) | Không |
| 2 | Thêm chốt chặn hẹn giờ (§5) | Không |
| 3 | Tách đôi đường bỏ phiếu + sửa cờ "bỏ phiếu được không" (§3.3) | **Có** |
| 4 | Thêm giá trị pha mới + bảng tra thời lượng + bảng tra quyền theo pha (§2.1, §2.4) | Không |
| 5 | Nối pha kỹ năng vào vòng lượt, có điều kiện (§3.1) | **Có** |
| 6 | Hai loại hành động mới + ràng buộc "1 lần cả ván" — **kiểm chứng ngay** (§2.2) | Không |
| 7 | Thêm Phù thuỷ vào cấu hình vai (§2.3) | **Có** |
| 8 | Nới phần kiểm tra quyền dùng kỹ năng (§3.4) | Không |
| 9 | Thuốc độc (§3.5) | **Có** |
| 10 | Thuốc cứu + nối vào phần xử lý cái chết (§3.5, §3.2) | **Có** |
| 11 | Thông tin riêng của Phù thuỷ + đường xem lịch sử (§3.6, §3.7) | **Có** |
| 12 | Rà rò rỉ theo §6 | Không |
| 13 | Cập nhật tài liệu | Không |

**Bước 1–4 nên gộp thành một đợt review riêng trước khi bắt đầu Phù thuỷ.** Chúng đổi cấu trúc vòng lượt và cách xử lý cái chết — trộn với logic vai mới thì rất khó review, mà đây đúng là chỗ dễ làm hỏng ván đấu nhất.

---

## 5. Rủi ro kỹ thuật

### Hẹn giờ bắn trùng — nguy hiểm hơn trước

Việc chuyển pha hiện chỉ kiểm "ván còn đang chạy không", **không kiểm tra pha có khớp với cái hẹn giờ đã đặt hay không**. Với 2 pha cùng 60 giây thì hậu quả nhẹ. Với 3 pha khác thời lượng, một hẹn giờ cũ bắn muộn sẽ **đẩy ván nhảy vọt một pha** — mất luôn lượt của Phù thuỷ, hoặc áp dụng cái chết sai thời điểm.

**Cách bịt:** so thời điểm kết thúc pha đang lưu với hiện tại; nếu còn ở tương lai thì bỏ qua, vì nghĩa là pha đó đã được xử lý rồi. Làm ở bước 2, trước khi thêm pha.

### Ràng buộc có điều kiện

Xem cảnh báo ở §2.2. **Cách kiểm chứng:** bật app 2–3 lần liên tiếp với chế độ ghi log SQL, xem có câu xoá/tạo index nào lặp lại mỗi lần khởi động không.

Nếu không ổn định: vẫn giữ bảng hành động làm nguồn sự thật, bỏ ràng buộc có điều kiện và **chỉ kiểm tra ở tầng ứng dụng**, bù lại bằng khoá ở tầng giao dịch. **Không** rơi về phương án thêm cột đánh dấu vào bảng người chơi — đã loại vì làm trạng thái nhân đôi ở hai nơi.

### Vòng lượt dài ngắn thay đổi giữa ván

Khi Phù thuỷ chết, lượt ngắn từ 135 giây xuống 120 giây. Client đếm ngược theo thời điểm kết thúc pha lấy từ server nên không sai, nhưng **client không được cứng hoá "một lượt luôn có 3 pha"**.

---

## 6. Checklist rà rò rỉ (bước 12, không được bỏ)

Compiler không bắt được loại lỗi này, phải đọc tay từng chỗ:

- [x] Trạng thái ván **không** chứa nạn nhân của đêm, không chứa dữ liệu nào từ bảng hành động
- [x] Kiểm phiếu (cả hai loại) cũng vậy
- [x] Khối thông tin của Phù thuỷ chỉ dựng khi người gọi **đúng là Phù thuỷ**; vai khác không có khoá đó **kể cả rỗng**
- [x] Nạn nhân chỉ trả **trong pha kỹ năng**; trả ở ban ngày là lộ nguyên nhân chết
- [x] Lịch sử dùng thuốc lọc theo danh tính lấy từ **token**, không theo tham số client gửi lên
- [x] Người chết vì thuốc độc và người chết vì Sói cắn **nhìn giống hệt nhau**
- [x] Không có phản hồi nào cho biết thuốc cứu có trúng hay không
- [x] Pha kỹ năng **vẫn diễn ra** khi Phù thuỷ còn sống nhưng đã hết cả hai bình

Cả 8 mục đã xác nhận bằng test tự động (viết tạm, chạy xong xoá — không commit vào repo). Xem §8.

---

## 7. Kiểm chứng thủ công

Kịch bản đầy đủ ở [PLAN-PHU-THUY.md §16](../PLAN-PHU-THUY.md). Bốn bài **dễ bỏ sót nhất** — đã xác nhận bằng test tự động thay vì chơi thật (không có Postgres trong môi trường code hiện tại):

1. **Bỏ phiếu trong pha kỹ năng** — phải bị từ chối, **và** cờ "bỏ phiếu được không" phải trả `false`. ✅
2. **Phù thuỷ tự cứu mình** — Sói cắn đúng Phù thuỷ, pha kỹ năng vẫn phải mở và cô ấy cứu được. ✅
3. **Phù thuỷ còn sống nhưng hết cả hai bình** — pha kỹ năng vẫn phải chạy đủ 15 giây. ✅
4. **Khởi động app 3 lần liên tiếp** — log SQL không được có câu xoá/tạo index lặp lại (§5). ❌ **Chưa làm được** — không có DB thật để thử. Xem §8.

---

## 8. Kết quả thi công — lệch/phát sinh so với kế hoạch

**Không có lệch nào về logic.** Toàn bộ §2 và §3 code đúng như mô tả. Những điều đáng ghi lại:

### 8.1. Đặt tên pha

Đặt tên giá trị enum là `SKILL` (trung tính, không gắn tên Phù thuỷ) — đúng theo Quyết định #6 đã chốt trong PLAN. Tên hàm/biến trong code không nằm trong phạm vi tài liệu này nên không liệt kê ở đây.

### 8.2. ⚠️ Chưa kiểm chứng được rủi ro ràng buộc có điều kiện (§5)

Môi trường code hiện tại **không có Postgres** để khởi động app thật. Nên:

- Chưa xác nhận được `synchronize: true` tạo đúng partial unique index `UQ_game_actions_witch_once_per_game` như thiết kế.
- Chưa chạy được bài kiểm tra "khởi động 3 lần liên tiếp, xem log SQL có DROP/CREATE index lặp lại không".

**Việc cần làm trước khi coi tính năng này production-ready:** kết nối tới một Postgres thật (dev hoặc staging), chạy app, xác nhận bảng `game_actions` có đúng 2 index (ràng buộc cũ theo lượt, và ràng buộc mới có điều kiện theo cả ván), rồi khởi động lại vài lần để chắc là `synchronize` không đảo index liên tục. Nếu không ổn định thì dùng phương án dự phòng đã ghi ở §5 Rủi ro kỹ thuật (chuyển kiểm tra "còn thuốc không" xuống tầng ứng dụng).

### 8.3. Kiểm chứng bằng test tự động, không phải chơi thật

Toàn bộ 8 mục checklist §6 và 4 bài kiểm chứng thủ công ở §7 (trừ mục về index) đã được xác nhận bằng một bộ test tự động viết trong lúc code — mô phỏng kho dữ liệu trong bộ nhớ (không cần Postgres) và gọi trực tiếp các hàm nghiệp vụ, gồm cả việc chạy `advanceGame()` nhiều lần liên tiếp để đi qua đúng trình tự `NIGHT → SKILL → DAY → NIGHT` như lúc chơi thật. Bộ test này **không được commit** (theo yêu cầu "không cần test" đã chốt từ trước) — chạy xong đã xoá. Khi có Postgres thật, nên chạy lại toàn bộ kịch bản ở §7 bằng tay ít nhất một lần trước khi coi là xong.
