import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsArray,
  IsDateString,
  IsUUID,
} from 'class-validator';
import { WorkerClassification, EngagementModel } from '@prisma/client';

export class CreateContractorDto {
  @ApiProperty()
  @IsUUID()
  supplierId: string;

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

  @ApiProperty({ enum: WorkerClassification, default: WorkerClassification.INDEPENDENT_CONTRACTOR })
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
}
