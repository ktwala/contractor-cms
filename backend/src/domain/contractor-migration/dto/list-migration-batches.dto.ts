import { ApiPropertyOptional } from '@nestjs/swagger';
import { ContractorMigrationBatchStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListMigrationBatchesDto {
  @ApiPropertyOptional({
    description: 'Target organization (required for global CMS_ADMIN)',
  })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({ enum: ContractorMigrationBatchStatus })
  @IsOptional()
  @IsEnum(ContractorMigrationBatchStatus)
  status?: ContractorMigrationBatchStatus;

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
  pageSize?: number = 20;
}
