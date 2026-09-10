# Vai Bảo vệ (Guardian)

Mỗi đêm chọn **1 người** để che. Nếu đêm đó Sói cắn đúng người này thì **không ai chết**.

**Trạng thái: đã thực thi (2026-09-10).** Tham chiếu: [luat-choi.md §4.3](./luat-choi.md), [role-tien-tri.md](./role-tien-tri.md) (mô hình bảng hành động dùng chung).

---

## 1. Luật

| # | Luật | Vi phạm thì |
|---|---|---|
| 1 | Chỉ dùng được **ban đêm** | 409 |
| 2 | Chỉ vai **Bảo vệ** dùng được | 403 |
| 3 | Phải **còn sống** | 403 |
| 4 | **Mỗi đêm đúng 1 lần**, không đổi ý | 409 |
| 5 | **Không được tự che mình** | 400 |
| 6 | **Không che trùng một người 2 đêm liên tiếp** | 400 |
| 7 | Mục tiêu phải thuộc ván và còn sống | 404 / 409 |

Luật 6 là luật bắt buộc của vai này: thiếu nó thì Bảo vệ khoá cứng được một người và phe Sói gần như không thể thắng. Cách đêm rồi che lại người cũ thì **được** — chỉ cấm 2 đêm liền nhau.

## 2. Che chặn được gì

| Nguồn chết | Che có cứu được? |
|---|---|
| Sói cắn ban đêm | ✅ Có |
| Cả làng treo cổ ban ngày | ❌ Không |

Đây là điểm dễ cài sai nhất: việc kiểm phiếu dùng chung một hàm cho cả hai pha, nên phải kiểm tra pha trước khi áp dụng che.

## 3. Bảo vệ KHÔNG biết mình che trúng hay trượt

Không có phản hồi nào cho biết đêm qua Sói có nhắm vào người được che hay không. Báo cho Bảo vệ biết "đã cứu được một mạng" đồng nghĩa với **tiết lộ luôn Sói nhắm ai** — thông tin đó Bảo vệ không được phép có.

Cả làng chỉ thấy kết quả gián tiếp: sáng ra không có ai chết.

Vì vậy phản hồi khi che thành công cố ý **không chứa bất kỳ thông tin gì về mục tiêu**:

```jsonc
POST /games/:gameId/guardian/protect   { "targetUserId": 6 }
→ { "dayNumber": 2, "targetUserId": 6 }
```

## 4. Client biết trước làm được gì

Qua endpoint cá nhân `GET /games/:gameId/me` — chỉ dựng khi người gọi đúng là Bảo vệ:

```jsonc
{
  "userId": 4, "role": "guardian", "isAlive": true,
  "canVoteNow": false, "myVoteTargetId": null,
  "guardian": {
    "canProtectNow": true,
    "protectedThisNight": null,          // { targetUserId } nếu đêm nay đã che
    "blockedTargetUserId": 6             // người bị cấm chọn vì đã che đêm trước
  }
}
```

`blockedTargetUserId` để client tô mờ người đó trong danh sách, thay vì để người chơi bấm rồi ăn lỗi 400. Không rò rỉ gì — Bảo vệ vốn đã tự biết đêm trước mình che ai.

Lịch sử đầy đủ: `GET /games/:gameId/guardian/protects`, chỉ Bảo vệ đọc được, lọc theo danh tính từ access token.

## 5. Lưu trữ

Dùng chung bảng `game_actions` với Tiên tri, phân biệt bằng `actionType = GUARDIAN_PROTECT`. Cột `result` để `null` — vai này không sinh ra thông tin gì.

Ràng buộc `UNIQUE(gameId, dayNumber, actionType, actorId)` cài luật 4. Luật 6 tra bản ghi của `dayNumber - 1`; đêm đầu (`dayNumber = 0`) thì không có đêm trước nên luôn hợp lệ.

Lúc kiểm phiếu, việc tra "người này có được che không" tìm theo **targetId** chứ không theo người che — nên nếu sau này có nhiều Bảo vệ trong một ván thì vẫn chạy đúng.

## 6. Cấu hình vai

| Số người | Sói | Dân | Bảo vệ | Tiên tri |
|---|---|---|---|---|
| 6 | 1 | 4 | 1 | 0 |
| 8 | 2 | 4 | 1 | 1 |
| 10 | 2 | 6 | 1 | 1 |
| 15 | 3 | 10 | 1 | 1 |

## 7. Trường hợp biên

| Tình huống | Xử lý |
|---|---|
| Bảo vệ tự che mình | Cấm (luật 5) |
| Bảo vệ che rồi chết ngay đêm đó | Che vẫn có hiệu lực — bản ghi đã tồn tại trước lúc kiểm phiếu |
| Đêm đầu tiên (`dayNumber = 0`) | Không có đêm trước, che ai cũng được |
| Sói hoà phiếu, không cắn ai | Che không phát huy tác dụng, không sao |
| Không có ai vai Bảo vệ | Endpoint luôn 403, phần kiểm phiếu chạy như cũ |
| Ván bị huỷ | Bản ghi xoá theo ván (cascade) |
