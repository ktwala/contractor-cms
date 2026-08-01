import { IsOptional, IsString } from 'class-validator';

export class UpdateStatutoryReturnStatusDto {
  @IsOptional()
  @IsString()
  comment?: string;
}
