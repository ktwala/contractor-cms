import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsDateString,
  IsNumber,
  IsObject,
  IsInt,
  Min,
  IsUUID,
} from 'class-validator';
import { ContractType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateContractDto {
  @ApiProperty()
  @IsUUID()
  supplierId: string;

  @ApiProperty()
  @IsString()
  contractNumber: string;

  @ApiProperty({ enum: ContractType })
  @IsEnum(ContractType)
  contractType: ContractType;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ default: 'ZAR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  totalValue?: number;

  @ApiPropertyOptional({
    description: 'Rate card JSON object, e.g., {"Senior Developer": 1500, "Junior Developer": 800}',
  })
  @IsOptional()
  @IsObject()
  rateCard?: Record<string, number>;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  paymentTermsDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  noticePeriodDays?: number;

  @ApiPropertyOptional({
    description: 'SLA terms as JSON object',
  })
  @IsOptional()
  @IsObject()
  slaTerms?: Record<string, any>;
}
