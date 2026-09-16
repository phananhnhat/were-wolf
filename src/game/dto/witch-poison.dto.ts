import { IsInt } from 'class-validator';

export class WitchPoisonDto {
  @IsInt()
  targetUserId: number;
}
