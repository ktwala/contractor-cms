import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class GeneratePeriodsDto {
  @ApiProperty({ example: 2026, minimum: 2000 })
  @IsInt()
  @Min(2000)
  year: number;
}

export class GeneratePeriodsResponseDto {
  @ApiProperty({ example: 'pg_za_123' })
  pay_group_id: string;

  @ApiProperty({ example: 2026 })
  year: number;

  @ApiProperty({ example: 12 })
  created_count: number;
}
