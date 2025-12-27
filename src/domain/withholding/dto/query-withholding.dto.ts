import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsInt,
  Min,
  IsUUID,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TaxClassification, WithholdingType } from './create-withholding.dto';
import { SyncStatus } from './update-withholding.dto';

export class QueryWithholdingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  contractorId?: string;

  @ApiPropertyOptional({ enum: WithholdingType })
  @IsOptional()
  @IsEnum(WithholdingType)
  withholdingType?: WithholdingType;

  @ApiPropertyOptional({ enum: TaxClassification })
  @IsOptional()
  @IsEnum(TaxClassification)
  classification?: TaxClassification;

  @ApiPropertyOptional({ enum: SyncStatus })
  @IsOptional()
  @IsEnum(SyncStatus)
  syncStatus?: SyncStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveDateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveDateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  taxYear?: number;

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
