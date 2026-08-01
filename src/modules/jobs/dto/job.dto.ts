import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export enum JobType {
  PAYRUN_CALCULATION = 'PAYRUN_CALCULATION',
  PAYRUN_SNAPSHOT = 'PAYRUN_SNAPSHOT',
  EXPORT_BANK_FILE = 'EXPORT_BANK_FILE',
  EXPORT_GL_JOURNAL = 'EXPORT_GL_JOURNAL',
  EXPORT_PAYSLIPS = 'EXPORT_PAYSLIPS',
  EXPORT_TAX_CERTIFICATE = 'EXPORT_TAX_CERTIFICATE',
  IMPORT_EMPLOYEES = 'IMPORT_EMPLOYEES',
  IMPORT_PAY_ITEMS = 'IMPORT_PAY_ITEMS',
}

export enum JobStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export class CreateJobDto {
  @ApiProperty({ enum: JobType })
  @IsEnum(JobType)
  type: JobType;

  @ApiPropertyOptional({ example: { payrun_id: 'pr_123' } })
  @IsOptional()
  payload?: Record<string, any>;
}

export class ListJobsDto {
  @ApiPropertyOptional({ enum: JobType })
  @IsOptional()
  @IsEnum(JobType)
  type?: JobType;

  @ApiPropertyOptional({ enum: JobStatus })
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;

  @ApiPropertyOptional({ example: 'pr_123' })
  @IsOptional()
  @IsString()
  reference_id?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class JobResponseDto {
  @ApiProperty({ example: 'job_123' })
  id: string;

  @ApiProperty({ enum: JobType })
  type: JobType;

  @ApiProperty({ enum: JobStatus })
  status: JobStatus;

  @ApiPropertyOptional({ example: 75 })
  progress?: number;

  @ApiPropertyOptional({ example: { payrun_id: 'pr_123' } })
  payload?: Record<string, any>;

  @ApiPropertyOptional({ example: { processed: 50, total: 100 } })
  result?: Record<string, any>;

  @ApiPropertyOptional({ example: 'Calculation failed for employee emp_456' })
  error?: string;

  @ApiProperty({ example: 'user_789' })
  created_by: string;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  created_at: string;

  @ApiPropertyOptional({ example: '2026-01-15T10:30:05.000Z' })
  started_at?: string;

  @ApiPropertyOptional({ example: '2026-01-15T10:35:00.000Z' })
  completed_at?: string;
}

export class JobListResponseDto {
  @ApiProperty({ type: [JobResponseDto] })
  data: JobResponseDto[];

  @ApiProperty()
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
