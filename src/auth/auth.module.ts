import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { UserSession } from './entities/user-session.entity';
import { SESSION_REPOSITORY } from './domain/repositories/session.repository';
import { PASSWORD_HASHER } from './application/ports/password-hasher';
import { TOKEN_ISSUER } from './application/ports/token-issuer';
import { USER_DIRECTORY } from './application/ports/user-directory';
import { TypeOrmSessionRepository } from './infrastructure/persistence/typeorm-session.repository';
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher';
import { JwtTokenIssuer } from './infrastructure/jwt-token-issuer';
import { TypeOrmUserDirectory } from './infrastructure/user-directory.adapter';

// Composition root của AuthModule. Vẫn import UsersModule — nhưng chỉ để
// TypeOrmUserDirectory (Infrastructure) inject USER_REPOSITORY của UsersModule; Domain/
// Application/Facade của AuthModule chỉ biết USER_DIRECTORY do chính AuthModule định nghĩa,
// xem application/ports/user-directory.ts.
@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([UserSession]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtRefreshStrategy,
    { provide: SESSION_REPOSITORY, useClass: TypeOrmSessionRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: TOKEN_ISSUER, useClass: JwtTokenIssuer },
    { provide: USER_DIRECTORY, useClass: TypeOrmUserDirectory },
  ],
})
export class AuthModule {}
