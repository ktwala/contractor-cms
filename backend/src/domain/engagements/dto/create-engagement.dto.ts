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

export enum RateType {
  HOURLY = 'HOURLY',
  DAILY = 'DAILY',
  FIXED = 'FIXED',
}

export class CreateEngagementDto {
  @ApiProperty()
  @IsUUID()
  contractorId: string;

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

  @ApiProperty({ description: 'Role for this engagement (e.g., Senior Developer, QA Engineer)' })
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

  /** PR-SPONSOR-RUNTIME-1 — opaque substrate; not verified against HCM. */
  @ApiPropertyOptional({
    nullable: true,
    description:
      'Sponsor employee identifier (opaque; structural validation only until HCM bridge)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  responsibleManagerEmployeeId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Optional delegate sponsor employee identifier (opaque)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  responsibleManagerDelegateEmployeeId?: string | null;

  @ApiPropertyOptional({
    enum: ResponsibleManagerAccountabilityStatus,
    enumName: 'ResponsibleManagerAccountabilityStatus',
    nullable: true,
    description:
      'Sponsor accountability status. When `responsibleManagerEmployeeId` is set and this is omitted or null, the API defaults to RESPONSIBLE_MANAGER_ASSIGNED (PR-SPONSOR-GOVERNANCE-1). Setting a status without a primary `responsibleManagerEmployeeId` is rejected.',
  })
  @IsOptional()
  @IsEnum(ResponsibleManagerAccountabilityStatus)
  responsibleManagerStatus?: ResponsibleManagerAccountabilityStatus | null;
}
