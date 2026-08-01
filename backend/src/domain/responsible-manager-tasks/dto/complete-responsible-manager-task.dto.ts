import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CompleteResponsibleManagerTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  /** For ACCESS_NEED_CONFIRMATION — sponsor confirms access is still required. */
  @IsOptional()
  @IsBoolean()
  accessConfirmed?: boolean;
}
