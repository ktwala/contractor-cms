import { IsOptional, IsString, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListAuditLogsDto {
  @ApiPropertyOptional({ description: 'Filter from date (ISO 8601)' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: 'Filter to date (ISO 8601)' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ description: 'Filter by actor user ID' })
  @IsOptional()
  @IsString()
  actorUserId?: string;

  @ApiPropertyOptional({ description: 'Filter by action (e.g. USER_ROLE_ASSIGNED)' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ description: 'Filter by target type (e.g. User, Role)' })
  @IsOptional()
  @IsString()
  targetType?: string;

  @ApiPropertyOptional({ description: 'Filter by target ID or email' })
  @IsOptional()
  @IsString()
  targetId?: string;

  @ApiPropertyOptional({ description: 'Filter by result', enum: ['success', 'failed'] })
  @IsOptional()
  @IsIn(['success', 'failed'])
  result?: 'success' | 'failed';

  @ApiPropertyOptional({ description: 'Filter by organizationId' })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'Filter by severity' })
  @IsOptional()
  @IsString()
  severity?: string;

  @ApiPropertyOptional({ description: 'Filter by tags (comma separated)' })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({
    description: 'Free-text search across actor email, targetId, action (NOT JSON fields)',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number (1-indexed)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page size (max 100)', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 50;
}
