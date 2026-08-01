import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsArray,
  IsDateString,
  MaxLength,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WorkerClassification, EngagementModel } from '@prisma/client';
import { RateType } from '../../engagements/dto/create-engagement.dto';

/** Placement intent for enterprise independent acquire — sponsor required (ADR-013). */
export class AcquireIndependentEngagementDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  costCenterId?: string;

  @ApiProperty({ description: 'Role for this engagement (e.g., Senior Advisor)' })
  @IsString()
  role: string;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ enum: RateType })
  @IsEnum(RateType)
  rateType: RateType;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rateAmount: number;

  @ApiPropertyOptional({ default: 'ZAR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({
    description: 'Primary sponsor employee identifier — required before workforce ACTIVE',
  })
  @IsString()
  @MaxLength(2048)
  responsibleManagerEmployeeId: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  responsibleManagerDelegateEmployeeId?: string | null;
}

/** Enterprise independent intake — enters at NOMINATED (ADR-013 Step 6). */
export class AcquireIndependentContractorDto {
  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  idNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  passportNumber?: string;

  @ApiProperty({
    enum: WorkerClassification,
    description: 'Worker taxonomy — distinct from acquisition authority (ADR-013).',
  })
  @IsEnum(WorkerClassification)
  workerClassification: WorkerClassification;

  @ApiProperty({ enum: EngagementModel })
  @IsEnum(EngagementModel)
  engagementModel: EngagementModel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxNumber?: string;

  @ApiProperty({ description: 'Tax residency country code (e.g., ZA, US)' })
  @IsString()
  taxResidency: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  accessExpiresAt?: string;

  @ApiPropertyOptional({ description: 'Optional governance note at acquisition' })
  @IsOptional()
  @IsString()
  sponsorNote?: string;

  @ApiPropertyOptional({ description: 'Optional acquisition reason for audit trail' })
  @IsOptional()
  @IsString()
  acquisitionReason?: string;

  @ApiProperty({ type: AcquireIndependentEngagementDto })
  @ValidateNested()
  @Type(() => AcquireIndependentEngagementDto)
  engagement: AcquireIndependentEngagementDto;
}
