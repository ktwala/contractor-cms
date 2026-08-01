import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { PayRunType } from '../../../common/dto/enums.dto';

/** Same period inputs as create payrun — preview uses identical date resolution. */
export class PreviewPayrunInclusionsDto {
  @ApiProperty({ example: 'pg_za_123' })
  @IsString()
  @IsNotEmpty()
  pay_group_id: string;

  @ApiPropertyOptional({ example: 'pp_za_2026_01', description: 'Provide either period_id OR all of period_start, period_end, pay_date' })
  @IsOptional()
  @IsString()
  period_id?: string;

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

  @ApiPropertyOptional({ enum: PayRunType, description: 'Included for contract parity; inclusion logic is the same for REGULAR.' })
  @IsOptional()
  @IsEnum(PayRunType)
  run_type?: PayRunType;
}
