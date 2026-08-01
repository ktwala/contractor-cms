import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray, IsDateString } from 'class-validator';

export class SnapshotRequestDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  include_employee_ids?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  exclude_employee_ids?: string[];

  @ApiProperty({ example: '2026-01-15' })
  @IsDateString()
  snapshot_effective_at: string;
}

export class SnapshotResponseDto {
  @ApiProperty({ example: 'pr_456' })
  payrun_id: string;

  @ApiProperty({ example: 'SNAPSHOT' })
  status: string;

  @ApiProperty({ example: 50 })
  included_count: number;
}
