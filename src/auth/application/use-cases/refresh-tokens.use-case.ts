import { SessionRepository } from '../../domain/repositories/session.repository';
import { PasswordHasher } from '../ports/password-hasher';
import { TokenIssuer } from '../ports/token-issuer';
import {
  issueTokenPair,
  Identity,
  TokenPair,
} from './issue-token-pair.use-case';

export function refreshTokens(
  sessions: SessionRepository,
  tokenIssuer: TokenIssuer,
  hasher: PasswordHasher,
  identity: Identity,
  oldSessionId: string,
): Promise<TokenPair> {
  return issueTokenPair(sessions, tokenIssuer, hasher, identity, oldSessionId);
}
