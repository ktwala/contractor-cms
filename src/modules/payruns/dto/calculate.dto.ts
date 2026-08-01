import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsArray, IsBoolean } from 'class-validator';

export class CalculateRequestDto {
  @ApiProperty({ enum: ['FULL', 'PARTIAL'], example: 'FULL' })
  @IsEnum(['FULL', 'PARTIAL'])
  mode: 'FULL' | 'PARTIAL';

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recalculate_employee_ids?: string[];

  @ApiPropertyOptional({
    description: 'Use the country-pack engine for calculation (synchronous)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  use_engine?: boolean;
}

export class CalculateResponseDto {
  @ApiProperty({ example: 'job_calc_123' })
  job_id: string;

  @ApiProperty({ example: 'pr_456' })
  payrun_id: string;

  @ApiProperty({ example: 'CALCULATED' })
  status: string;
}
