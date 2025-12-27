import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsString,
  IsDateString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

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
}
