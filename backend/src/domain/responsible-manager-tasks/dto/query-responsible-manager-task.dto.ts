import { IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ResponsibleManagerTaskStatus } from '@prisma/client';

export class QueryResponsibleManagerTaskDto {
  @IsOptional()
  @IsEnum(ResponsibleManagerTaskStatus)
  status?: ResponsibleManagerTaskStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
