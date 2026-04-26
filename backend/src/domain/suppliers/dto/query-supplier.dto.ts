import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { SupplierType, SupplierStatus } from '@prisma/client';

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
