import { IsOptional, IsString } from 'class-validator';

export class MarkStatutoryReturnSubmittedDto {
  @IsOptional()
  @IsString()
  submission_reference?: string;

  @IsOptional()
  @IsString()
  submitted_at?: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
