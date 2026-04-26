import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsString,
  IsDateString,
  IsOptional,
  IsInt,
  IsNumber,
  IsEnum,
  IsObject,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum TaxClassification {
  TRUE_INDEPENDENT = 'TRUE_INDEPENDENT',
  DEEMED_EMPLOYEE = 'DEEMED_EMPLOYEE',
}

export enum WithholdingType {
  PAYE = 'PAYE',
  SDL = 'SDL',
  UIF = 'UIF',
}

export class CreateWithholdingDto {
  @ApiProperty()
  @IsUUID()
  contractorId: string;

  @ApiProperty()
  @IsString()
  taxClassificationId: string;

  @ApiProperty()
  @IsDateString()
  effectiveDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'HCM worker ID if known' })
  @IsOptional()
  @IsString()
  workerExternalId?: string;

  @ApiProperty({ enum: WithholdingType, description: 'PAYE, SDL, or UIF' })
  @IsEnum(WithholdingType)
  withholdingType: WithholdingType;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  taxYear: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  grossAmount: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  withholdingAmount: number;

  @ApiPropertyOptional({ default: 'ZAR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ enum: TaxClassification })
  @IsEnum(TaxClassification)
  classification: TaxClassification;

  @ApiPropertyOptional({ description: 'Risk score 0-100' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  riskScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dominantImpression?: string;

  @ApiProperty({ description: 'Canonical payload for HCM adapter' })
  @IsObject()
  canonicalPayload: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adapterType?: string;
}
