# Luật chơi Ma Sói (Werewolf)

Tài liệu này mô tả **luật chơi** cơ bản của Ma Sói làm cơ sở tham chiếu cho `GameModule` (chia vai, xử lý lượt đêm/ngày, điều kiện thắng thua). Đây chỉ là tài liệu luật chơi, không phải thiết kế kỹ thuật — thiết kế quản lý phòng xem [room.md](./room.md), auth xem [auth-flow.md](./auth-flow.md).

---

## 1. Tổng quan

- Mỗi người chơi được bí mật gán một **vai trò** thuộc một trong các phe: **Dân làng**, **Ma Sói**, hoặc **phe thứ ba** (độc lập).
- Ván chơi luân phiên giữa hai pha: **Ban đêm** (các vai có kỹ năng hành động bí mật) và **Ban ngày** (cả làng thảo luận công khai rồi bỏ phiếu treo cổ một người bị nghi ngờ).
- Ván kết thúc khi một phe đạt **điều kiện thắng** của phe đó.

---

## 2. Các phe

| Phe | Mục tiêu thắng |
|---|---|
| Dân làng (Villager) | Tiêu diệt hết Ma Sói |
| Ma Sói (Werewolf) | Số Sói còn sống ≥ số Dân còn sống (Sói "áp đảo" được làng) |
| Phe thứ ba (VD: Người điên, Kẻ ăn thịt người...) | Điều kiện thắng riêng, độc lập với 2 phe trên |

---

## 3. Danh sách vai trò

### 3.1. Phe Ma Sói

| Vai trò | Kỹ năng đêm |
|---|---|
| Sói thường (Werewolf) | Cùng các Sói khác thức dậy, chọn 1 người để cắn (giết) |
| Sói chúa / Sói ẩn (mở rộng) | Biến thể nâng cao — có thể biến người khác thành sói hoặc miễn nhiễm 1 lần bị giết |

### 3.2. Phe Dân làng

| Vai trò | Kỹ năng đêm |
|---|---|
| Dân thường (Villager) | Không có kỹ năng, chỉ bỏ phiếu ban ngày |
| Tiên tri (Seer) | Mỗi đêm soi 1 người, biết người đó là Sói hay không phải Sói |
| Bảo vệ (Guard/Bodyguard) | Mỗi đêm chọn 1 người để bảo vệ khỏi bị Sói cắn đêm đó (không được bảo vệ trùng người 2 đêm liên tiếp) |
| Phù thủy (Witch) | Có 2 bình thuốc dùng 1 lần cả ván: thuốc cứu (cứu người bị Sói cắn đêm đó) và thuốc độc (giết 1 người bất kỳ) |
| Thợ săn (Hunter) | Khi bị giết (do Sói cắn hoặc bị treo cổ), được bắn theo 1 người khác cùng chết |
| Cô bé (Little Girl, mở rộng) | Được phép "nghe lén" đêm Sói bàn bạc, nhưng rủi ro bị Sói phát hiện |

### 3.3. Phe thứ ba (mở rộng)

| Vai trò | Đặc điểm |
|---|---|
| Người điên (Tanner/Fool) | Thắng nếu chính mình bị dân làng treo cổ |
| Kẻ ăn thịt người (Cannibal, tuỳ biến thể) | Thắng theo điều kiện riêng, không phe nào |

> Vai trò cụ thể của mỗi ván được xác định qua `ROLE_CONFIG_BY_MAX_PLAYERS[room.maxPlayers]` (định nghĩa tĩnh trong code, xem mục 6 bên dưới), ví dụ `{"werewolf":1,"villager":4,"seer":1}` với phòng 6 người.

---

## 4. Trình tự một lượt chơi (1 ngày = 1 đêm + 1 ngày)

```
Đêm 0 (đêm đầu tiên, không ai chết trước đó)
        │
        ▼
  Ban đêm ──► Sói chọn nạn nhân ──► Bảo vệ chọn người bảo vệ ──► Phù thủy quyết định cứu/độc ──► Tiên tri soi
        │
        ▼
  Ban ngày ──► Công bố người chết đêm qua ──► Thảo luận ──► Bỏ phiếu treo cổ ──► Công bố kết quả
        │
        └──► Kiểm tra điều kiện thắng, nếu chưa thoả → quay lại Ban đêm
```

Thứ tự hành động ban đêm (quan trọng vì ảnh hưởng kết quả):
1. Sói chọn nạn nhân.
2. Bảo vệ chọn người được bảo vệ (không được trùng người đêm trước).
3. Phù thủy nhìn thấy nạn nhân bị Sói cắn, quyết định dùng thuốc cứu (nếu còn) và/hoặc thuốc độc.
4. Tiên tri soi 1 người, nhận kết quả "Sói" / "Không phải Sói".
5. Tổng hợp kết quả: người bị cắn mà **không** được bảo vệ và **không** được cứu → chết vào sáng hôm sau.

Ban ngày:
1. Quản trò (hệ thống) công bố người chết đêm qua (nếu có nhiều nguồn giết trong đêm — VD vừa bị cắn vừa bị đầu độc — công bố tất cả).
2. Nếu người chết là **Thợ săn**, được kích hoạt kỹ năng bắn 1 người khác trước khi lượt kết thúc.
3. Cả làng thảo luận, sau đó bỏ phiếu công khai. Người bị nhiều phiếu nhất bị treo cổ (nếu có kỹ năng kích hoạt khi chết, xử lý tương tự bước 2).
4. Kiểm tra điều kiện thắng (mục 2); nếu chưa ai thắng, chuyển sang đêm tiếp theo.

---

## 5. Điều kiện thắng chi tiết

| Điều kiện | Phe thắng |
|---|---|
| Không còn Ma Sói nào sống | Dân làng |
| Số Sói sống ≥ số Dân sống | Ma Sói |
| Người điên bị dân làng treo cổ | Người điên (thắng riêng, ván vẫn có thể tiếp tục cho các phe khác nếu dùng luật nhiều phe thắng độc lập) |

Ván chơi dừng ngay khi một điều kiện thắng được thoả mãn ở cuối pha đêm hoặc cuối pha ngày.

---

## 6. Cấu hình vai trò theo số người chơi

`rooms.maxPlayers` chỉ nhận 1 trong 4 giá trị cố định (xem [room.md §1.1](./room.md)). Vai trò tương ứng mỗi mốc được định nghĩa tĩnh trong code ở `ROLE_CONFIG_BY_MAX_PLAYERS` (`src/rooms/constants/room-configs.ts`), không lưu DB:

| Số người | Vai trò |
|---|---|
| 6 | 1 Sói, 4 Dân thường, 1 Tiên tri |
| 8 | 2 Sói, 4 Dân thường, 1 Tiên tri, 1 Bảo vệ |
| 10 | 2 Sói, 4 Dân thường, 1 Tiên tri, 1 Bảo vệ, 1 Phù thủy, 1 Thợ săn |
| 15 | 3 Sói, 6 Dân thường, 1 Tiên tri, 1 Bảo vệ, 1 Phù thủy, 1 Thợ săn, 1 Người điên |

---

## 7. Ghi chú cho `GameModule` (ngoài phạm vi tài liệu này)

- Việc chia vai ngẫu nhiên theo `ROLE_CONFIG_BY_MAX_PLAYERS[room.maxPlayers]` khi phòng `start()` thuộc về `GameModule`, kích hoạt qua event `room.started` (xem [game.md](./game.md)).
- Trạng thái "còn sống/đã chết" của từng người chơi trong ván, lượt hiện tại (đêm/ngày, số thứ tự), lịch sử bỏ phiếu... là state riêng của `GameModule`, không thuộc `RoomsModule`.
- Xử lý "rời phòng giữa ván" (rớt mạng) được đánh dấu "disconnected" ở tầng `GameModule`, không xoá khỏi ván đang chơi (xem [room.md §4.3](./room.md)).
