import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { USER_DIRECTORY } from '../application/ports/user-directory';
import type { UserDirectory } from '../application/ports/user-directory';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';
import type { TokenPayload } from '../application/ports/token-issuer';

// Strategy tên 'jwt' — được AuthGuard('jwt') trong JwtAuthGuard gọi đến.
// Nhiệm vụ: xác minh access token và trả về danh tính rút gọn để gắn vào req.user.
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    @Inject(USER_DIRECTORY) private readonly users: UserDirectory,
  ) {
    super({
      // Lấy token từ header: Authorization: Bearer <token>
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Dùng JWT_ACCESS_SECRET để verify chữ ký — sai secret → tự động reject
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  // Passport tự verify chữ ký và hạn token trước, hợp lệ mới gọi hàm này
  // payload là nội dung đã decode từ token: { sub, username }
  // Giá trị trả về sẽ được Passport gắn vào req.user
  async validate(payload: TokenPayload): Promise<AuthenticatedUser> {
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException();
    return { id: user.id, username: user.username };
  }
}
