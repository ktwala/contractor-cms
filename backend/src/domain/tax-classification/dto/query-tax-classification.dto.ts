import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsInt,
  Min,
  IsUUID,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TaxClassification, ClassificationBasis } from './create-tax-classification.dto';

export class QueryTaxClassificationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  contractorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  engagementId?: string;

  @ApiPropertyOptional({ enum: TaxClassification })
  @IsOptional()
  @IsEnum(TaxClassification)
  classification?: TaxClassification;

  @ApiPropertyOptional({ enum: ClassificationBasis })
  @IsOptional()
  @IsEnum(ClassificationBasis)
  basis?: ClassificationBasis;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validTo?: string;

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
