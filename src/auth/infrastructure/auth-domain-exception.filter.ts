import { Catch } from '@nestjs/common';
import { DomainExceptionFilter } from '../../common/domain-exception.filter';
import { AuthDomainError } from '../domain/errors/auth-domain.error';

@Catch(AuthDomainError)
export class AuthDomainExceptionFilter extends DomainExceptionFilter<AuthDomainError> {}
