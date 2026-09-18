import { SessionRepository } from '../../domain/repositories/session.repository';
import { Session } from '../../domain/entities/session.entity';
import { SessionId } from '../../domain/value-objects/session-id.vo';
import { TokenIssuer } from '../ports/token-issuer';
import { PasswordHasher } from '../ports/password-hasher';

export interface Identity {
  id: number;
  username: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// Cấp 1 cặp access+refresh token mới, ghi session (refresh token đã hash). Dùng chung bởi
// loginUser() và refreshTokens() — y hệt cách CastWolfVoteUseCase/CastLynchVoteUseCase cùng gọi
// getVoteTally() ở GameModule. `oldSessionId` có thì xoá session cũ (rotation).
export async function issueTokenPair(
  sessions: SessionRepository,
  tokenIssuer: TokenIssuer,
  hasher: PasswordHasher,
  identity: Identity,
  oldSessionId?: string,
): Promise<TokenPair> {
  const sessionId = SessionId.generate();

  const [accessToken, refreshToken] = await Promise.all([
    tokenIssuer.issueAccessToken({
      sub: identity.id,
      username: identity.username,
    }),
    tokenIssuer.issueRefreshToken({
      sub: identity.id,
      username: identity.username,
      sid: sessionId.toString(),
    }),
  ]);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const session = Session.create({
    id: sessionId,
    userId: identity.id,
    tokenHash: await hasher.hash(refreshToken),
    expiresAt,
  });
  await sessions.save(session);

  if (oldSessionId) {
    await sessions.deleteById(oldSessionId, identity.id);
  }

  return { accessToken, refreshToken };
}
