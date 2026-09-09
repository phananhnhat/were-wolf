import { IsInt } from 'class-validator';

export class GuardianProtectDto {
  @IsInt()
  targetUserId: number;
}
