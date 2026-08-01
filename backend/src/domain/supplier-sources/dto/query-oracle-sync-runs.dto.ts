import { ApiPropertyOptional } from '@nestjs/swagger';
import { SupplierSourceSyncRunMode, SupplierSourceSyncRunStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class QueryOracleSyncRunsDto {
  @ApiPropertyOptional({ enum: SupplierSourceSyncRunStatus })
  @IsOptional()
  @IsEnum(SupplierSourceSyncRunStatus)
  status?: SupplierSourceSyncRunStatus;

  @ApiPropertyOptional({ enum: SupplierSourceSyncRunMode })
  @IsOptional()
  @IsEnum(SupplierSourceSyncRunMode)
  mode?: SupplierSourceSyncRunMode;

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
