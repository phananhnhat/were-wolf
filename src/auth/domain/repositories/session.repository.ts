import { Session } from '../entities/session.entity';

export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');

export interface SessionRepository {
  findByIdAndUser(id: string, userId: number): Promise<Session | null>;
  save(session: Session): Promise<void>;
  deleteById(id: string, userId: number): Promise<void>;
  deleteAllForUser(userId: number): Promise<void>;
}
