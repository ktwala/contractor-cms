import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';

export class CreatePayRunDto {
  @ApiProperty({ example: 'pg_za_123' })
  @IsString()
  @IsNotEmpty()
  pay_group_id: string;

  @ApiPropertyOptional({ example: 'pp_za_2026_01', description: 'Provide either period_id OR dates' })
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
