# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Use `npm` (pnpm workspace is present but node_modules are managed via npm in practice).

```bash
npm install               # install dependencies
npm run start:dev         # run in watch mode (hot reload)
npm run build             # compile to dist/
npm run start:prod        # run compiled output

npm run lint              # ESLint with auto-fix
npm run format            # Prettier

npm run test                                    # unit tests (jest, rootDir: src)
npm run test:watch                              # watch mode
npm run test:cov                                # coverage report
npm run test:e2e                                # e2e tests (test/jest-e2e.json)
npm run test -- --testPathPattern=auth          # run a single spec file
```

Server starts on `PORT` env var, defaulting to **3000**.

## Environment

Copy `.env.example` → `.env` and fill in values before starting:

```
DATABASE_URL=postgresql://postgres:password@localhost:5432/werewolf
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
JWT_ACCESS_EXPIRES_IN=15m    # optional, default 15m
JWT_REFRESH_EXPIRES_IN=7d    # optional, default 7d
```

PostgreSQL is expected via Docker. `synchronize: true` auto-creates/alters tables in development (disable in production).

## Architecture

NestJS 11 REST API with TypeScript and PostgreSQL (TypeORM).

### Module structure

```
src/
  auth/
    strategies/jwt.strategy.ts          # validates accessToken, sets req.user
    strategies/jwt-refresh.strategy.ts  # validates refreshToken + checks hashed copy in DB
    guards/jwt-auth.guard.ts            # global guard — skips routes marked @Public()
    guards/jwt-refresh.guard.ts         # applied only on POST /auth/refresh
    decorators/public.decorator.ts      # @Public() — opt-out from global JWT guard
    decorators/current-user.decorator.ts # @CurrentUser() — extracts req.user
    dto/{register,login,change-password}.dto.ts
    auth.service.ts                     # register, login, logout, refresh, changePassword
    auth.controller.ts                  # POST /auth/{register,login,refresh,logout,change-password}
  users/
    entities/user.entity.ts             # TypeORM entity; password + refreshToken @Exclude()'d
    users.service.ts                    # TypeORM repository CRUD + findByUsername/Email + updateRefreshToken
    users.module.ts                     # exports UsersService (consumed by AuthModule)
  groups/                               # in-memory CRUD (no DB), same pattern as users
  app.module.ts                         # registers ConfigModule, TypeOrmModule, global JwtAuthGuard
  main.ts                               # ValidationPipe (whitelist) + ClassSerializerInterceptor
```

### Auth flow

- **Register / Login** → `issueTokens()` signs both tokens, stores bcrypt-hashed refreshToken in `users.refresh_token`; returns `{ accessToken, refreshToken }`.
- **Protected routes** → send `Authorization: Bearer <accessToken>`. `JwtAuthGuard` is applied globally; use `@Public()` to bypass.
- **Refresh** → send `Authorization: Bearer <refreshToken>` to `POST /auth/refresh`. `JwtRefreshStrategy` compares the raw token against the hashed DB copy (token rotation on every refresh).
- **Logout** → nulls `refreshToken` in DB, invalidating the refresh session.
- **Change password** → verifies current password, re-hashes new one, invalidates all refresh sessions.

### Key conventions

- `@Exclude()` on `User.password` and `User.refreshToken` — `ClassSerializerInterceptor` strips them from all responses automatically.
- DTOs use `class-validator` decorators; `ValidationPipe({ whitelist: true })` strips unknown fields globally.
- `noImplicitAny` is **disabled** in `tsconfig.json`.
- `expiresIn` in `jwtService.signAsync` requires a cast to `never` due to the `StringValue` branded type in `@nestjs/jwt` v11+.
