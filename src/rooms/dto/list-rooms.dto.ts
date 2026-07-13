import { IsNumberString, IsOptional } from 'class-validator';

export class ListRoomsDto {
  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;
}
