import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  TokenIssuer,
  TokenPayload,
  RefreshTokenPayload,
} from '../application/ports/token-issuer';

@Injectable()
export class JwtTokenIssuer implements TokenIssuer {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  issueAccessToken(payload: TokenPayload): Promise<string> {
    const expiresIn = this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m';
    return this.jwtService.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      // @nestjs/jwt's `expiresIn` type là branded StringValue ('15m', '7d', ...) từ
      // jsonwebtoken, không phải `string` thường — giá trị đọc từ .env luôn là string thường,
      // ép kiểu là cách duy nhất qua được type check này (đúng hành vi gốc của AuthService cũ).
      expiresIn: expiresIn as never,
    });
  }

  issueRefreshToken(payload: RefreshTokenPayload): Promise<string> {
    const expiresIn = this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    return this.jwtService.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: expiresIn as never,
    });
  }

  // Khai báo `async` — jwtService.verify() ném lỗi ĐỒNG BỘ khi token sai/hết hạn; đánh dấu
  // `async` (dù thân hàm không có `await`) để TypeScript tự bọc lỗi đồng bộ đó thành Promise bị
  // reject, cho phép nơi gọi dùng `.catch(...)` bình thường (logoutUser() dựa vào điều này để
  // coi token hỏng là no-op).
  // eslint-disable-next-line @typescript-eslint/require-await
  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    return this.jwtService.verify<RefreshTokenPayload>(token, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
    });
  }
}
