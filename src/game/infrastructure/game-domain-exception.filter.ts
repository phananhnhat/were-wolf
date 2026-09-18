import { Catch } from '@nestjs/common';
import { DomainExceptionFilter } from '../../common/domain-exception.filter';
import { GameDomainError } from '../domain/errors/game-domain.error';

@Catch(GameDomainError)
export class GameDomainExceptionFilter extends DomainExceptionFilter<GameDomainError> {}
