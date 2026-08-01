import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class PackageInputDto {
  @ApiProperty({ example: 120000, description: 'Total cost-to-company (monthly)' })
  @IsNumber()
  @Min(1)
  ctc!: number;

  @ApiPropertyOptional({ example: 80000, description: 'Target net pay (only for TARGET_NET mode)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  targetNet?: number;

  @ApiProperty({ example: 15000 })
  @IsNumber()
  @Min(0)
  medicalAidAmount!: number;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(0)
  beneficiaries!: number;

  @ApiPropertyOptional({ enum: ['EMPLOYER_FUNDED', 'EMPLOYEE_PAID'], default: 'EMPLOYER_FUNDED' })
  @IsOptional()
  @IsString()
  medicalFundingModel?: 'EMPLOYER_FUNDED' | 'EMPLOYEE_PAID';
}

class PolicyInputDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  allowTravelAllowance!: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  requireRetirementFund!: boolean;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumRetirementAmount?: number;
}

class AdvancedConstraintsDto {
  @ApiPropertyOptional({ example: 55 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minBasicPercent?: number;

  @ApiPropertyOptional({ example: 35 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAllowancePercent?: number;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxTravelPercent?: number;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxReimbursiveAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requireMedicalAsEmployerContribution?: boolean;
}

export class RunSimpleCtcOptimiserDto {
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

  @ApiProperty({ enum: ['MAX_NET', 'TARGET_NET', 'BALANCED'] })
  @IsString()
  optimisationMode!: 'MAX_NET' | 'TARGET_NET' | 'BALANCED';

  @ApiProperty({ type: PackageInputDto })
  @ValidateNested()
  @Type(() => PackageInputDto)
  packageInput!: PackageInputDto;

  @ApiProperty({ type: PolicyInputDto })
  @ValidateNested()
  @Type(() => PolicyInputDto)
  policyInput!: PolicyInputDto;

  @ApiPropertyOptional({ type: AdvancedConstraintsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AdvancedConstraintsDto)
  advancedConstraints?: AdvancedConstraintsDto;
}
