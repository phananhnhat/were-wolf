// PORT — ký/verify JWT. Tách ra để Application layer không biết `JwtService`/`ConfigService`
// của NestJS tồn tại — Infrastructure layer (jwt-token-issuer.ts) mới là nơi đọc
// JWT_ACCESS_SECRET/JWT_REFRESH_SECRET/... qua ConfigService.
export interface TokenPayload {
  sub: number; // userId
  username: string;
}

export interface RefreshTokenPayload extends TokenPayload {
  sid: string; // session UUID trong bảng user_sessions
}

export interface TokenIssuer {
  issueAccessToken(payload: TokenPayload): Promise<string>;
  issueRefreshToken(payload: RefreshTokenPayload): Promise<string>;
  // Ném lỗi (reject) nếu token không hợp lệ/hết hạn — nơi gọi tự quyết định xử lý thế nào
  // (vd. logoutUser() coi token không hợp lệ là no-op, không phải lỗi).
  verifyRefreshToken(token: string): Promise<RefreshTokenPayload>;
}

export const TOKEN_ISSUER = Symbol('TOKEN_ISSUER');
