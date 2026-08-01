import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsEnum, IsDateString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AdjustmentMode } from '../../../common/dto/enums.dto';

export class PeriodOverrideDto {
  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  period_start?: string;

  @ApiPropertyOptional({ example: '2026-01-31' })
  @IsOptional()
  @IsDateString()
  period_end?: string;

  @ApiPropertyOptional({ example: '2026-01-25' })
  @IsOptional()
  @IsDateString()
  pay_date?: string;
}

export class AdjustmentPayRunCreateDto {
  @ApiPropertyOptional({ example: 'Retroactive salary increase for Q1' })
  @IsOptional()
  @IsString()
  adjustment_reason?: string;

  @ApiPropertyOptional({ enum: AdjustmentMode, default: AdjustmentMode.DELTA_ONLY })
  @IsOptional()
  @IsEnum(AdjustmentMode)
  adjustment_mode?: 'DELTA_ONLY' | 'FULL_RECALC';

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  include_employee_ids?: string[];

  @ApiPropertyOptional({ type: PeriodOverrideDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PeriodOverrideDto)
  period_override?: PeriodOverrideDto;
}
