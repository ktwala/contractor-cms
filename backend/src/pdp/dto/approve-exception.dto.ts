import { IsOptional, IsString } from 'class-validator';

export class ApproveExceptionDto {
  @IsOptional()
  @IsString()
  approvalNotes?: string;

  @IsString()
  expiresAt: string; // ISO date string
}

export class RejectExceptionDto {
  @IsOptional()
  @IsString()
  approvalNotes?: string;
}
