import { BaseDomainError } from '../../../common/domain-error';

export type RoomDomainErrorCode =
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'FORBIDDEN'
  | 'BAD_REQUEST'
  | 'INTERNAL';

export abstract class RoomDomainError extends BaseDomainError {
  protected constructor(code: RoomDomainErrorCode, message: string) {
    super(code, message);
  }
}
