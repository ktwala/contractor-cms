import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PayrunGLConfirmationSourceType } from '@prisma/client';

export class GlConfirmationImportDto {
  @ApiProperty({ example: 'GL_BATCH_2026-01' })
  @IsString()
  @IsNotEmpty()
  gl_batch_reference!: string;

  @ApiProperty({ enum: PayrunGLConfirmationSourceType })
  @IsEnum(PayrunGLConfirmationSourceType)
  source_type!: PayrunGLConfirmationSourceType;

  @ApiProperty({ example: 500000 })
  @Type(() => Number)
  @IsNumber()
  gl_gross!: number;

  @ApiProperty({ example: 400000 })
  @Type(() => Number)
  @IsNumber()
  gl_net!: number;

  @ApiProperty({ example: 80000 })
  @Type(() => Number)
  @IsNumber()
  gl_paye!: number;

  @ApiProperty({ example: 20000 })
  @Type(() => Number)
  @IsNumber()
  gl_deductions!: number;

  @ApiPropertyOptional({ description: 'Optional payload for checksum / future parsing' })
  @IsOptional()
  @IsString()
  csv_text?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  account_mapping_drift?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  cost_center_variance?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  timing_lag?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  rounding_only?: boolean;
}
