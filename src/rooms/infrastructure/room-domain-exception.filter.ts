import { Catch } from '@nestjs/common';
import { DomainExceptionFilter } from '../../common/domain-exception.filter';
import { RoomDomainError } from '../domain/errors/room-domain.error';

@Catch(RoomDomainError)
export class RoomDomainExceptionFilter extends DomainExceptionFilter<RoomDomainError> {}
