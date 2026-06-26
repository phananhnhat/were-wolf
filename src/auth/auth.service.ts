import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import * as bcryptjs from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { UserSession } from './entities/user-session.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtPayload, RefreshPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(UserSession)
    private readonly sessionsRepo: Repository<UserSession>,
  ) {}

  async register(dto: RegisterDto) {
    if (await this.usersService.findByUsername(dto.username)) {
      throw new BadRequestException('Username already taken');
    }
    if (await this.usersService.findByEmail(dto.email)) {
      throw new BadRequestException('Email already in use');
    }

    const password = await bcryptjs.hash(dto.password, 10);
    const user = await this.usersService.create({ ...dto, password });

    return this.issueTokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByUsername(dto.username);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcryptjs.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokens(user);
  }

  async refreshTokens(user: User, oldSessionId: string) {
    return this.issueTokens(user, oldSessionId);
  }

  async logout(
    userId: number,
    rawRefreshToken: string,
  ): Promise<{ message: string }> {
    try {
      const payload = this.jwtService.verify<RefreshPayload>(rawRefreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      if (payload.sub === userId) {
        await this.sessionsRepo.delete({ id: payload.sid, userId });
      }
    } catch {
      // token không hợp lệ thì không cần xóa
    }
    return { message: 'Logged out successfully' };
  }

  async changePassword(
    userId: number,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findOne(userId);
    const valid = await bcryptjs.compare(dto.currentPassword, user.password);
    if (!valid) throw new ForbiddenException('Current password is incorrect');

    const password = await bcryptjs.hash(dto.newPassword, 10);
    await this.usersService.update(userId, { password });
    await this.sessionsRepo.delete({ userId });

    return { message: 'Password changed successfully' };
  }

  private async issueTokens(user: User, oldSessionId?: string) {
    const sessionId = randomUUID();
    const payload: JwtPayload = { sub: user.id, username: user.username };
    const refreshPayload: RefreshPayload = { ...payload, sid: sessionId };

    const accessExpiry = (this.config.get('JWT_ACCESS_EXPIRES_IN') ??
      '15m') as string;
    const refreshExpiry = (this.config.get('JWT_REFRESH_EXPIRES_IN') ??
      '7d') as string;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessExpiry as never,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiry as never,
      }),
    ]);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.sessionsRepo.save({
      id: sessionId,
      userId: user.id,
      tokenHash: await bcryptjs.hash(refreshToken, 10),
      expiresAt,
    });

    if (oldSessionId) {
      await this.sessionsRepo.delete({ id: oldSessionId, userId: user.id });
    }

    return { accessToken, refreshToken };
  }
}
