import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsInt, Min, IsBoolean, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { WorkerClassification, EngagementModel } from '@prisma/client';

export class QueryContractorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ enum: WorkerClassification })
  @IsOptional()
  @IsEnum(WorkerClassification)
  workerClassification?: WorkerClassification;

  @ApiPropertyOptional({ enum: EngagementModel })
  @IsOptional()
  @IsEnum(EngagementModel)
  engagementModel?: EngagementModel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxResidency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  skill?: string;

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
