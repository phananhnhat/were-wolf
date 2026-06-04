import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcryptjs from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
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

  async refreshTokens(user: User) {
    return this.issueTokens(user);
  }

  async logout(userId: number): Promise<{ message: string }> {
    await this.usersService.updateRefreshToken(userId, null);
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
    await this.usersService.updateRefreshToken(userId, null);

    return { message: 'Password changed successfully' };
  }

  private async issueTokens(user: User) {
    const payload: JwtPayload = { sub: user.id, username: user.username };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: (this.config.get('JWT_ACCESS_EXPIRES_IN') ?? '15m') as never,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: (this.config.get('JWT_REFRESH_EXPIRES_IN') ?? '7d') as never,
      }),
    ]);

    await this.usersService.updateRefreshToken(
      user.id,
      await bcryptjs.hash(refreshToken, 10),
    );

    return { accessToken, refreshToken };
  }
}
