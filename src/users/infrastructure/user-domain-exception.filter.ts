import { Catch } from '@nestjs/common';
import { DomainExceptionFilter } from '../../common/domain-exception.filter';
import { UserDomainError } from '../domain/errors/user-domain.error';

@Catch(UserDomainError)
export class UserDomainExceptionFilter extends DomainExceptionFilter<UserDomainError> {}
