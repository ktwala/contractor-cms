import { IsEnum, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { DataImportDatasetType, DataImportStatus } from '@prisma/client';

export class ListImportJobsDto {
  @IsOptional()
  @IsEnum(DataImportDatasetType)
  dataset_type?: DataImportDatasetType;

  @IsOptional()
  @IsEnum(DataImportStatus)
  status?: DataImportStatus;

  @IsOptional()
  @Type(() => Number)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  offset?: number = 0;
}
