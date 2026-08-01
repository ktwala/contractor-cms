import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsString,
  IsDateString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ResponsibleManagerAccountabilityStatus } from '@prisma/client';
import { RateType } from '../../engagements/dto/create-engagement.dto';

/** Placement intent captured at nomination — not full onboarding (PR-WORKFORCE-NOMINATE-1). */
export class NominateContractorEngagementDto {
  @ApiProperty()
  @IsUUID()
  contractId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  costCenterId?: string;

  @ApiProperty({ description: 'Role for this engagement (e.g., Senior Developer)' })
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

  @ApiPropertyOptional({
    nullable: true,
    description: 'Primary sponsor employee identifier (opaque substrate)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  responsibleManagerEmployeeId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  responsibleManagerDelegateEmployeeId?: string | null;

  @ApiPropertyOptional({
    enum: ResponsibleManagerAccountabilityStatus,
    enumName: 'ResponsibleManagerAccountabilityStatus',
    nullable: true,
  })
  @IsOptional()
  @IsEnum(ResponsibleManagerAccountabilityStatus)
  responsibleManagerStatus?: ResponsibleManagerAccountabilityStatus | null;
}
