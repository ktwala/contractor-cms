import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsArray, IsDateString, ValidateNested, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { Country, RoundingMode } from '../../../common/dto/enums.dto';

export class RoundingDto {
  @ApiPropertyOptional({ enum: RoundingMode, default: RoundingMode.HALF_UP })
  @IsOptional()
  @IsEnum(RoundingMode)
  mode?: RoundingMode;

  @ApiPropertyOptional({ default: 2 })
  @IsOptional()
  @IsInt()
  decimals?: number;
}

export class CreateRuleDto {
  @ApiProperty({ example: 'TAXABLE_INCOME' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Calculate Taxable Income' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ enum: Country, description: 'Leave null for global rules' })
  @IsOptional()
  @IsEnum(Country)
  country?: Country;

  @ApiProperty({
    example: 'GROSS - PENSION_DEDUCTION - MEDICAL_AID',
    description: 'Expression/DSL evaluated by rule engine'
  })
  @IsString()
  @IsNotEmpty()
  expression: string;

  @ApiPropertyOptional({ type: [String], example: ['GROSS', 'PENSION_DEDUCTION'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dependencies?: string[];

  @ApiPropertyOptional({ type: RoundingDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RoundingDto)
  rounding?: RoundingDto;

  @ApiProperty({ example: '2024-03-01' })
  @IsDateString()
  effective_from: string;

  @ApiPropertyOptional({ example: '2025-02-28' })
  @IsOptional()
  @IsDateString()
  effective_to?: string;
}
