import { IsEnum, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { DataImportRowStatus } from '@prisma/client';

export class ListImportRowsDto {
  @IsOptional()
  @IsEnum(DataImportRowStatus)
  status?: DataImportRowStatus;

  @IsOptional()
  @Type(() => Number)
  limit?: number = 100;

  @IsOptional()
  @Type(() => Number)
  offset?: number = 0;
}
