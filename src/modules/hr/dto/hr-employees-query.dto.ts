import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class HrEmployeesQueryDto {
  @ApiPropertyOptional({
    description: 'Return employees updated after this timestamp (ISO 8601). Enables delta sync.',
  })
  @IsOptional()
  @IsString()
  changed_since?: string;

  @ApiPropertyOptional({ default: 200, minimum: 1, maximum: 1000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  @Type(() => Number)
  limit?: number = 200;

  @ApiPropertyOptional({
    description: 'Opaque cursor for pagination (offset-based). Omit for first page.',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated: current_employment, manager (default: current_employment,manager)',
  })
  @IsOptional()
  @IsString()
  include?: string;

  @ApiPropertyOptional({
    description: 'Resolve current_employment as of this date (ISO 8601). Omit for "as of now". Enables point-in-time snapshots and testing future-dated changes.',
  })
  @IsOptional()
  @IsString()
  as_of?: string;
}
