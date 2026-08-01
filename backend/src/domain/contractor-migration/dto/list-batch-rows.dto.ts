import { ApiPropertyOptional } from '@nestjs/swagger';
import { HcmStagingValidationStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListBatchRowsDto {
  @ApiPropertyOptional({
    description: 'Target organization (required for global CMS_ADMIN)',
  })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({ enum: HcmStagingValidationStatus })
  @IsOptional()
  @IsEnum(HcmStagingValidationStatus)
  validationStatus?: HcmStagingValidationStatus;

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
  @Max(200)
  pageSize?: number = 50;
}
