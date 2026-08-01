import { IsOptional, IsString } from 'class-validator';

export class GenerateStatutoryReturnDto {
  @IsOptional()
  @IsString()
  returnCode?: string;
}
