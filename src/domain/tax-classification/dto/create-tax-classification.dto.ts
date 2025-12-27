import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsEnum,
  IsObject,
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum TaxClassification {
  TRUE_INDEPENDENT = 'TRUE_INDEPENDENT',
  DEEMED_EMPLOYEE = 'DEEMED_EMPLOYEE',
}

export enum ClassificationBasis {
  STATUTORY_TEST = 'STATUTORY_TEST',
  COMMON_LAW = 'COMMON_LAW',
  CONSERVATIVE = 'CONSERVATIVE',
}

export class CreateTaxClassificationDto {
  @ApiProperty()
  @IsUUID()
  contractorId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  engagementId?: string;

  @ApiProperty({ enum: TaxClassification })
  @IsEnum(TaxClassification)
  classification: TaxClassification;

  @ApiProperty({ enum: ClassificationBasis })
  @IsEnum(ClassificationBasis)
  basis: ClassificationBasis;

  @ApiProperty({ description: 'SARS test assessment answers as JSON' })
  @IsObject()
  assessmentPayload: Record<string, any>;

  @ApiPropertyOptional({ description: 'Overall impression: EMPLOYEE_LIKE or CONTRACTOR_LIKE' })
  @IsOptional()
  @IsString()
  dominantImpression?: string;

  @ApiPropertyOptional({ description: 'Risk score 0-100 (higher = more employee-like)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  riskScore?: number;

  @ApiProperty()
  @IsDateString()
  validFrom: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
