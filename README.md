# Werewolf API

Backend cho game **Ma Sói (Werewolf)** chơi online theo phòng, thời gian thực — NestJS 11 +
TypeORM + PostgreSQL, đẩy trạng thái ván qua MQTT, xác thực JWT dual-token, kiến trúc Clean
Architecture rõ 4 lớp cho từng module nghiệp vụ.

## Tính năng

| Module       | Việc gì                                                                                                                                                    |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auth**     | Đăng ký/đăng nhập, access + refresh token có rotation, đăng xuất theo từng thiết bị                                                                        |
| **Users**    | Hồ sơ người dùng, chỉ tự sửa được hồ sơ của chính mình                                                                                                     |
| **Rooms**    | Tạo phòng bằng mã 6 ký tự, vào/rời phòng, bắt đầu ván (chỉ chủ phòng), tự dọn phòng khi hết người                                                          |
| **Game**     | Vòng lượt đêm/ngày tự động chuyển pha theo giờ, 5 vai (Sói, Dân, Bảo vệ, Tiên tri, Phù thuỷ), luật thắng thua, lịch sử hành động riêng của từng người chơi |
| **Realtime** | Đẩy trạng thái ván (đổi pha, ai chết, ai thắng, kết quả bỏ phiếu) tới client ngay khi xảy ra, qua MQTT — không cần client tự poll                          |

Chi tiết luật chơi: [docs/game-rules.md](./docs/game-rules.md), [docs/luat-choi.md](./docs/luat-choi.md).
Trạng thái từng tính năng, đã xong tới đâu: [PLAN.md](./PLAN.md).

## Kiến trúc

Mỗi module nghiệp vụ (`auth`, `users`, `rooms`, `game`) theo đúng 4 lớp của Clean Architecture —
**Domain** (luật nghiệp vụ thuần, không biết NestJS/TypeORM tồn tại) → **Application** (use case,
điều phối transaction) → **Interface Adapters** (Controller, TypeORM repository) →
**Frameworks & Drivers** (NestJS, TypeORM, Postgres). Quy tắc: mã nguồn chỉ phụ thuộc vào trong,
không bao giờ phụ thuộc ra ngoài — đổi ORM hay đổi framework chỉ ảnh hưởng 2 lớp ngoài cùng.

Giải thích đầy đủ + ví dụ luồng đi qua từng lớp: [CLEAN-ARCHITECTURE.md](./CLEAN-ARCHITECTURE.md).

### Realtime qua MQTT

`src/realtime/` host broker MQTT — **đổi được giữa 2 loại broker chỉ bằng cách đổi 1 provider**
trong `realtime.module.ts` (`AedesMqttBrokerAdapter` ↔ `EmqxMqttBrokerAdapter`), không đụng gì ở
`GameModule` hay bất kỳ use case nào:

- **Aedes** — broker chạy embedded ngay trong process NestJS, không cần hạ tầng riêng. Dùng lúc
  dev, hoặc môi trường chỉ chạy 1 instance.
- **EMQX** — broker chạy ngoài (`docker-compose.yml`, config-as-code ở `emqx/emqx.conf`), có
  cluster/persistence thật. Dùng khi cần chạy nhiều instance NestJS.

Hành động trong ván (bỏ phiếu, soi, che, đầu độc, cứu...) vẫn đi 100% qua REST như cũ — MQTT chỉ
đẩy trạng thái một chiều server → client, không nhận gì ngược lại từ client. Thiết kế đầy đủ,
kèm những cạm bẫy đã gặp lúc implement từng broker: [PLAN-REALTIME.md](./PLAN-REALTIME.md).

## Lệnh hay dùng

```bash
pnpm run start:dev              # chạy dev, watch mode
pnpm run build                  # build ra dist/
pnpm run lint                   # ESLint, tự fix
pnpm run test                   # unit test
pnpm run test:e2e               # e2e test
pnpm run test:cov               # coverage
```
