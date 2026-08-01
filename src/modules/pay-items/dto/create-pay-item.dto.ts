import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsBoolean, IsInt, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PayItemType } from '../../../common/dto/enums.dto';

export class PayItemCountryAttributesLSDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  taxable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  statutory_category?: string;
}

export class PayItemCountryAttributesZADto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  taxable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  uif_applicable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  sdl_applicable?: boolean;

  @ApiPropertyOptional({ example: '3601' })
  @IsOptional()
  @IsString()
  irp5_code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pensionable?: boolean;
}

export class PayItemCountryAttributesDto {
  @ApiPropertyOptional({ type: PayItemCountryAttributesLSDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PayItemCountryAttributesLSDto)
  LS?: PayItemCountryAttributesLSDto;

  @ApiPropertyOptional({ type: PayItemCountryAttributesZADto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PayItemCountryAttributesZADto)
  ZA?: PayItemCountryAttributesZADto;
}

export class CreatePayItemDto {
  @ApiProperty({ example: 'BASIC' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Basic Salary' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Monthly basic salary before deductions' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: PayItemType, example: PayItemType.EARNING })
  @IsEnum(PayItemType)
  type: PayItemType;

  @ApiPropertyOptional({ example: 'STATUTORY', description: 'Category grouping' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  taxable?: boolean;

  @ApiPropertyOptional({ example: '5100', description: 'GL account for debit' })
  @IsOptional()
  @IsString()
  gl_account?: string;

  @ApiPropertyOptional({ example: '2100', description: 'GL account for credit' })
  @IsOptional()
  @IsString()
  gl_account_credit?: string;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @IsInt()
  sort_order?: number;

  @ApiPropertyOptional({ example: 'BASIC * 0.01', description: 'Calculation formula' })
  @IsOptional()
  @IsString()
  formula?: string;

  @ApiPropertyOptional({ example: ['BASIC'], description: 'Formula dependencies' })
  @IsOptional()
  @IsString({ each: true })
  formula_deps?: string[];

  @ApiPropertyOptional({ type: PayItemCountryAttributesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PayItemCountryAttributesDto)
  country_attributes?: PayItemCountryAttributesDto;

  @ApiPropertyOptional({ description: 'Pay group ID (null for global)' })
  @IsOptional()
  @IsString()
  pay_group_id?: string;

  @ApiPropertyOptional({ default: false, description: 'System items cannot be deleted' })
  @IsOptional()
  @IsBoolean()
  is_system?: boolean;
}

export class UpdatePayItemDto {
  @ApiPropertyOptional({ example: 'Basic Salary' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Monthly basic salary before deductions' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: PayItemType })
  @IsOptional()
  @IsEnum(PayItemType)
  type?: PayItemType;

  @ApiPropertyOptional({ example: 'STATUTORY' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  taxable?: boolean;

  @ApiPropertyOptional({ example: '5100' })
  @IsOptional()
  @IsString()
  gl_account?: string;

  @ApiPropertyOptional({ example: '2100' })
  @IsOptional()
  @IsString()
  gl_account_credit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sort_order?: number;

  @ApiPropertyOptional({ example: 'BASIC * 0.01' })
  @IsOptional()
  @IsString()
  formula?: string;

  @ApiPropertyOptional({ example: ['BASIC'] })
  @IsOptional()
  @IsString({ each: true })
  formula_deps?: string[];

  @ApiPropertyOptional({ type: PayItemCountryAttributesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PayItemCountryAttributesDto)
  country_attributes?: PayItemCountryAttributesDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
