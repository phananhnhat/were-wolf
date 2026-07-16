import { IsInt } from 'class-validator';

export class CastVoteDto {
  @IsInt()
  targetUserId: number;
}
