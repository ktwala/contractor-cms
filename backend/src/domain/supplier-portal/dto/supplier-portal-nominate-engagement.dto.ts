import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ResponsibleManagerAccountabilityStatus } from '@prisma/client';
import { RateType } from '../../engagements/dto/create-engagement.dto';

/** Placement intent at supplier portal nomination (PR-SUPPLIER-PORTAL-WORKFORCE-NOMINATE-1). */
export class SupplierPortalNominateEngagementDto {
  @ApiProperty()
  @IsUUID()
  contractId: string;

  @ApiProperty()
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

  @ApiPropertyOptional({ nullable: true })
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
