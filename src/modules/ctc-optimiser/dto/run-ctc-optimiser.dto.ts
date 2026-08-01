import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class MedicalAidInputDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  beneficiaries!: number;

  @ApiPropertyOptional({ enum: ['EMPLOYER_FUNDED', 'EMPLOYEE_PAID'], default: 'EMPLOYER_FUNDED' })
  @IsOptional()
  @IsString()
  fundingModel?: 'EMPLOYER_FUNDED' | 'EMPLOYEE_PAID';
}

class RetirementInputDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  minAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  targetAmount?: number;
}

class TravelInputDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPercent?: number;
}

class ReimbursiveInputDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAmount?: number;
}

class OptimiserConstraintDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  minBasicPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAllowancePercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requireMedicalAidAsEmployerContribution?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requireRetirementFund?: boolean;
}

export class RunCtcOptimiserDto {
  @ApiProperty({ example: 'ZA' })
  @IsString()
  countryCode!: string;

  @ApiProperty({ example: '2025/2026' })
  @IsString()
  taxYear!: string;

  @ApiProperty({ example: 'monthly' })
  @IsString()
  payFrequency!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  legalEntityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiProperty({ example: 120000, description: 'Total cost-to-company (monthly)' })
  @IsNumber()
  @Min(1)
  ctc!: number;

  @ApiProperty({ enum: ['MAX_NET', 'TARGET_NET', 'BALANCED'] })
  @IsString()
  optimisationMode!: 'MAX_NET' | 'TARGET_NET' | 'BALANCED';

  @ApiPropertyOptional({ example: 80000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  targetNet?: number;

  @ApiProperty({ type: MedicalAidInputDto })
  @ValidateNested()
  @Type(() => MedicalAidInputDto)
  medicalAid!: MedicalAidInputDto;

  @ApiProperty({ type: RetirementInputDto })
  @ValidateNested()
  @Type(() => RetirementInputDto)
  retirement!: RetirementInputDto;

  @ApiProperty({ type: TravelInputDto })
  @ValidateNested()
  @Type(() => TravelInputDto)
  travel!: TravelInputDto;

  @ApiProperty({ type: ReimbursiveInputDto })
  @ValidateNested()
  @Type(() => ReimbursiveInputDto)
  reimbursive!: ReimbursiveInputDto;

  @ApiProperty({ type: OptimiserConstraintDto })
  @ValidateNested()
  @Type(() => OptimiserConstraintDto)
  constraints!: OptimiserConstraintDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  employeeContext?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  scenarioTags?: string[];
}
