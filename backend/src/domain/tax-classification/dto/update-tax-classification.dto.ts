import { PartialType } from '@nestjs/swagger';
import { CreateTaxClassificationDto } from './create-tax-classification.dto';
import { IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTaxClassificationDto extends PartialType(
  CreateTaxClassificationDto,
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  approvedBy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  approvedAt?: string;
}

export class ApproveTaxClassificationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
