# Luồng xử lý Authentication

Hệ thống xác thực sử dụng **dual-token** (access token + refresh token) với cơ chế rotation khi refresh.

---

## Các endpoint

| Method | Path | Yêu cầu xác thực | Mô tả |
|--------|------|------------------|-------|
| `POST` | `/auth/register` | Không | Đăng ký tài khoản mới |
| `POST` | `/auth/login` | Không | Đăng nhập |
| `POST` | `/auth/refresh` | Refresh token | Làm mới cặp token |
| `POST` | `/auth/logout` | Access token | Đăng xuất |
| `POST` | `/auth/change-password` | Access token | Đổi mật khẩu |

---

## 1. Đăng ký

1. Client gửi `name`, `username`, `email`, `password`
2. Hệ thống kiểm tra username và email chưa tồn tại
3. Mật khẩu được hash trước khi lưu
4. Trả về cặp access token + refresh token

---

## 2. Đăng nhập

1. Client gửi `username`, `password`
2. Hệ thống tìm user theo username, so khớp mật khẩu
3. Trả về cặp access token + refresh token

---

## 3. Làm mới token (Refresh)

1. Client gửi **refresh token** trong header `Authorization: Bearer`
2. Hệ thống xác minh refresh token hợp lệ và khớp với bản ghi trong DB
3. Cấp cặp token mới, refresh token cũ bị vô hiệu hóa ngay lập tức (rotation)

---

## 4. Đăng xuất

1. Client gửi access token
2. Hệ thống xóa refresh token phía server
3. Mọi yêu cầu refresh sau đó đều bị từ chối

---

## 5. Đổi mật khẩu

1. Client gửi mật khẩu hiện tại và mật khẩu mới kèm access token
2. Hệ thống xác minh mật khẩu hiện tại đúng
3. Cập nhật mật khẩu mới và xóa refresh token — buộc đăng nhập lại trên mọi thiết bị

---

## Bảo mật

| Điểm | Cách xử lý |
|------|-----------|
| Mật khẩu | Lưu dưới dạng hash, không lưu plain text |
| Refresh token | Lưu dưới dạng hash trong DB, không lưu plain text |
| Token rotation | Mỗi lần refresh cấp cặp token mới, token cũ bị vô hiệu hóa |
| Logout / đổi mật khẩu | Xóa refresh token server-side để invalidate toàn bộ session |
| Access token TTL | 15 phút |
| Refresh token TTL | 7 ngày |
