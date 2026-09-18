# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install          # install dependencies
pnpm run start:dev    # run with watch mode (development)
pnpm run build        # compile to dist/
pnpm run start:prod   # run compiled output
pnpm run lint         # ESLint with auto-fix
pnpm run format       # Prettier format
pnpm run test         # unit tests (jest, rootDir: src/)
pnpm run test:e2e     # e2e tests (test/jest-e2e.json)
pnpm run test:cov     # coverage report
```

Run a single test file:
```bash
pnpm run test -- --testPathPattern=auth
```

## Environment Variables

Required at startup (loaded via `@nestjs/config`):

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection URL |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens |
| `JWT_ACCESS_EXPIRES_IN` | Access token TTL (default: `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL (default: `7d`) |
| `PORT` | HTTP port (default: `3000`) |
| `MQTT_URL` | URL the backend's own MQTT publisher connects to (default: `mqtt://localhost:1883`) |
| `MQTT_TCP_PORT` | Port the embedded Aedes broker listens on for raw TCP (mobile/native) clients (default: `1883`) |
| `MQTT_WS_PORT` | Port the embedded Aedes broker listens on for MQTT-over-WebSocket (browser) clients (default: `8083`) |
| `MQTT_INTERNAL_PASSWORD` | Shared secret the backend's own MQTT publisher uses to authenticate with the embedded broker (not a JWT) |

## Architecture

### Auth flow (dual-token with refresh rotation)

- `JwtAuthGuard` is registered as a **global guard** via `APP_GUARD` in `AppModule`. Every route requires a valid access token by default.
- Mark public routes with `@Public()` (`src/auth/decorators/public.decorator.ts`) to bypass the guard.
- The refresh endpoint (`POST /auth/refresh`) uses `@Public()` + `@UseGuards(JwtRefreshGuard)` — it expects a **refresh token** in the `Authorization: Bearer` header instead of an access token.
- Refresh tokens are bcrypt-hashed before being stored in the `users.refreshToken` column. On each refresh, the old token is validated by `bcrypt.compare` against the stored hash, then a new pair is issued and the hash is updated.
- On logout or password change, `refreshToken` is set to `null`, invalidating the refresh token server-side.

### Global interceptors / pipes

- `ClassSerializerInterceptor` is global — `@Exclude()` on entity fields (e.g., `password`, `refreshToken`) is respected automatically in all responses.
- `ValidationPipe({ whitelist: true })` is global — DTOs strip unknown properties before they reach controllers.

### Database

- TypeORM with PostgreSQL. `synchronize: true` is currently enabled — **disable before deploying to production**.
- Only `User` is registered as a TypeORM entity in `AppModule`. The `groups` module currently uses a plain TypeScript interface (`Group`) with no database backing — it is a stub.

### Module boundaries

- `UsersModule` exports `UsersService` and `TypeOrmModule.forFeature([User])` for use by `AuthModule`.
- `AuthModule` imports `UsersModule` and registers both JWT strategies (`jwt` and `jwt-refresh`) as Passport strategies.
- `GroupsModule` is self-contained and has no database integration yet.

### `@CurrentUser()` decorator

`src/auth/decorators/current-user.decorator.ts` — extracts the authenticated user (populated by Passport into `req.user`) as a method parameter. Available on any non-public route.

### Realtime (MQTT)

`src/realtime/` hosts an **Aedes** MQTT broker embedded directly in the NestJS process (`MqttBrokerService`, `OnModuleInit`) — a temporary stand-in for a self-hosted EMQX, used while the realtime logic is being built out (see `PLAN-REALTIME.md`). Actions (vote, seer check, guardian protect, witch poison/heal) still go 100% through REST — MQTT is a **push-only** channel `GameModule`'s use cases (`start-game`, `advance-game`, `cast-wolf-vote`, `cast-lynch-vote`) publish to after a DB transaction commits, via the `RealtimeGamePublisher` port (`src/game/application/ports/realtime-game-publisher.ts`) and its `mqtt`-client adapter. Clients authenticate on CONNECT with their access token as the MQTT password; `authorizeSubscribe` only allows subscribing to `ww/room/{roomId}/...` topics for rooms the connecting user is actually a member of (checked via `RoomMembershipReader`).
