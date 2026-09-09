import { IsInt } from 'class-validator';

export class SeerCheckDto {
  // Người mà Tiên tri muốn soi trong đêm nay
  @IsInt()
  targetUserId: number;
}
