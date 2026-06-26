import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';

export interface RequestWithSession extends Request {
  sessionId: string;
}
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcryptjs from 'bcryptjs';
import { UsersService } from '../../users/users.service';
import { RefreshPayload } from './jwt.strategy';
import { UserSession } from '../entities/user-session.entity';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
    @InjectRepository(UserSession)
    private readonly sessionsRepo: Repository<UserSession>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: RequestWithSession, payload: RefreshPayload) {
    const rawToken = req.headers.authorization?.split(' ')[1];
    if (!rawToken) throw new UnauthorizedException();

    const session = await this.sessionsRepo.findOneBy({
      id: payload.sid,
      userId: payload.sub,
    });
    if (!session) throw new UnauthorizedException();

    if (session.expiresAt < new Date()) throw new UnauthorizedException();

    const matches = await bcryptjs.compare(rawToken, session.tokenHash);
    if (!matches) throw new UnauthorizedException();

    const user = await this.usersService.findOne(payload.sub).catch(() => null);
    if (!user) throw new UnauthorizedException();

    req.sessionId = payload.sid;
    return user;
  }
}
