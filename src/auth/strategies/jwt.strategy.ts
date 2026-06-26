import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';

export interface JwtPayload {
  sub: number; // userId
  username: string;
}

export interface RefreshPayload extends JwtPayload {
  sid: string; // session UUID trong bảng user_sessions
}

// Strategy tên 'jwt' — được AuthGuard('jwt') trong JwtAuthGuard gọi đến
// Nhiệm vụ: xác minh access token và trả về user để gắn vào req.user
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
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
  async validate(payload: JwtPayload) {
    const user = await this.usersService.findOne(payload.sub).catch(() => null);
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
