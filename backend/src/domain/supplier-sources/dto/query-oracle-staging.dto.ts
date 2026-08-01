import { ApiPropertyOptional } from '@nestjs/swagger';
import { SupplierSourceStagingMatchStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export class QueryOracleStagingDto {
  @ApiPropertyOptional({ enum: SupplierSourceStagingMatchStatus })
  @IsOptional()
  @IsEnum(SupplierSourceStagingMatchStatus)
  matchStatus?: SupplierSourceStagingMatchStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;
}
