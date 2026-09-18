import { Inject, Injectable } from '@nestjs/common';
import { USER_DIRECTORY } from './application/ports/user-directory';
import type { UserDirectory } from './application/ports/user-directory';
import { SESSION_REPOSITORY } from './domain/repositories/session.repository';
import type { SessionRepository } from './domain/repositories/session.repository';
import { PASSWORD_HASHER } from './application/ports/password-hasher';
import type { PasswordHasher } from './application/ports/password-hasher';
import { TOKEN_ISSUER } from './application/ports/token-issuer';
import type { TokenIssuer } from './application/ports/token-issuer';
import type {
  Identity,
  TokenPair,
} from './application/use-cases/issue-token-pair.use-case';
import { registerUser } from './application/use-cases/register-user.use-case';
import { loginUser } from './application/use-cases/login-user.use-case';
import { refreshTokens } from './application/use-cases/refresh-tokens.use-case';
import { logoutUser } from './application/use-cases/logout-user.use-case';
import { changeUserPassword } from './application/use-cases/change-user-password.use-case';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

// Facade (Interface Adapter) — nơi AuthController gọi vào. Chỉ inject 4 adapter thô của chính
// AuthModule (kể cả USER_DIRECTORY — port do AuthModule tự định nghĩa, không phải
// UserRepository của UsersModule), mỗi method gọi thẳng hàm use case.
@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_DIRECTORY) private readonly users: UserDirectory,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(TOKEN_ISSUER) private readonly tokenIssuer: TokenIssuer,
  ) {}

  register(dto: RegisterDto) {
    return registerUser(this.users, this.hasher, dto);
  }

  login(dto: LoginDto): Promise<TokenPair> {
    return loginUser(
      this.users,
      this.hasher,
      this.sessions,
      this.tokenIssuer,
      dto,
    );
  }

  refreshTokens(user: Identity, oldSessionId: string): Promise<TokenPair> {
    return refreshTokens(
      this.sessions,
      this.tokenIssuer,
      this.hasher,
      user,
      oldSessionId,
    );
  }

  logout(userId: number, rawRefreshToken: string) {
    return logoutUser(this.sessions, this.tokenIssuer, userId, rawRefreshToken);
  }

  changePassword(userId: number, dto: ChangePasswordDto) {
    return changeUserPassword(
      this.users,
      this.sessions,
      this.hasher,
      userId,
      dto,
    );
  }
}
