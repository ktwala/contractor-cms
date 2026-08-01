import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { SupplierType, SupplierStatus } from '@prisma/client';
import { SUPPLIER_GOVERNANCE_BUCKETS } from '../supplier-governance-query.util';

export class QuerySupplierDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: SupplierType })
  @IsOptional()
  @IsEnum(SupplierType)
  type?: SupplierType;

  @ApiPropertyOptional({ enum: SupplierStatus })
  @IsOptional()
  @IsEnum(SupplierStatus)
  status?: SupplierStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    description:
      'Oracle-linked governance bucket filter (synced / pending_evidence / active / suspended)',
    enum: SUPPLIER_GOVERNANCE_BUCKETS,
  })
  @IsOptional()
  @IsIn([...SUPPLIER_GOVERNANCE_BUCKETS])
  governanceBucket?: (typeof SUPPLIER_GOVERNANCE_BUCKETS)[number];

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
  limit?: number = 20;
}
