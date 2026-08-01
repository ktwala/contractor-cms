import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DataImportDatasetType } from '@prisma/client';

export class CreateImportJobDto {
  @IsEnum(DataImportDatasetType)
  dataset_type: DataImportDatasetType;

  @IsString()
  file_name: string;

  @IsOptional()
  @IsString()
  file_storage_path?: string;
}
