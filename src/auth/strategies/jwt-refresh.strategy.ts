import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { USER_DIRECTORY } from '../application/ports/user-directory';
import { SESSION_REPOSITORY } from '../domain/repositories/session.repository';
import { PASSWORD_HASHER } from '../application/ports/password-hasher';
import { validateRefreshSession } from '../application/use-cases/validate-refresh-session.use-case';
import type { UserDirectory } from '../application/ports/user-directory';
import type { SessionRepository } from '../domain/repositories/session.repository';
import type { PasswordHasher } from '../application/ports/password-hasher';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';
import type { RefreshTokenPayload } from '../application/ports/token-issuer';

export interface RequestWithSession extends Request {
  sessionId: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    config: ConfigService,
    @Inject(USER_DIRECTORY) private readonly users: UserDirectory,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(
    req: RequestWithSession,
    payload: RefreshTokenPayload,
  ): Promise<AuthenticatedUser> {
    const rawToken = req.headers.authorization?.split(' ')[1];
    if (!rawToken) throw new UnauthorizedException();

    const user = await validateRefreshSession(
      this.users,
      this.sessions,
      this.hasher,
      payload.sub,
      payload.sid,
      rawToken,
    ).catch(() => null);
    if (!user) throw new UnauthorizedException();

    req.sessionId = payload.sid;
    return { id: user.id, username: user.username };
  }
}
