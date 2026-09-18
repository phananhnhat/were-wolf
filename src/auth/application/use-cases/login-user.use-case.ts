import type { UserDirectory } from '../ports/user-directory';
import type { SessionRepository } from '../../domain/repositories/session.repository';
import type { PasswordHasher } from '../ports/password-hasher';
import type { TokenIssuer } from '../ports/token-issuer';
import { InvalidCredentialsError } from '../../domain/errors/invalid-credentials.error';
import { issueTokenPair, TokenPair } from './issue-token-pair.use-case';

export interface LoginInput {
  username: string;
  password: string;
}

export async function loginUser(
  users: UserDirectory,
  hasher: PasswordHasher,
  sessions: SessionRepository,
  tokenIssuer: TokenIssuer,
  input: LoginInput,
): Promise<TokenPair> {
  const user = await users.findByUsername(input.username);
  if (!user) throw new InvalidCredentialsError();

  const valid = await hasher.compare(input.password, user.passwordHash);
  if (!valid) throw new InvalidCredentialsError();

  return issueTokenPair(sessions, tokenIssuer, hasher, {
    id: user.id,
    username: user.username,
  });
}
