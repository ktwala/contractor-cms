import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PayrunBankConfirmationSourceType } from '@prisma/client';

export class BankConfirmationImportDto {
  @ApiPropertyOptional({ description: 'Defaults to latest exported batch for this payrun' })
  @IsOptional()
  @IsString()
  payment_batch_id?: string;

  @ApiProperty({ enum: PayrunBankConfirmationSourceType })
  @IsEnum(PayrunBankConfirmationSourceType)
  source_type!: PayrunBankConfirmationSourceType;

  @ApiProperty({ example: 'bank_ack_2026-01-15.csv' })
  @IsString()
  @IsNotEmpty()
  bank_file_reference!: string;

  @ApiProperty({ example: 125000.5 })
  @Type(() => Number)
  @IsNumber()
  bank_confirmed_total!: number;

  @ApiProperty({ example: 42 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  bank_confirmed_employee_count!: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rejected_count?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  partial_count?: number;

  @ApiPropertyOptional({ description: 'Operator attests rejected rows were reviewed' })
  @IsOptional()
  @IsBoolean()
  rejected_cleared?: boolean;

  @ApiPropertyOptional({ description: 'Operator attests partial settlement was reviewed' })
  @IsOptional()
  @IsBoolean()
  partial_cleared?: boolean;

  @ApiPropertyOptional({ description: 'Optional raw CSV text for checksum / future parsing' })
  @IsOptional()
  @IsString()
  csv_text?: string;

  @ApiPropertyOptional({ description: 'Mark stale confirmation (soft warning)' })
  @IsOptional()
  @IsBoolean()
  stale_confirmation?: boolean;
}
