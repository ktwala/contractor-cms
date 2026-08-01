import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PayPeriodResponseDto {
  @ApiProperty({ example: 'pp_za_2026_01' })
  id: string;

  @ApiProperty({ example: 'pg_za_123' })
  pay_group_id: string;

  @ApiProperty({ example: '2026-01-01' })
  start_date: string;

  @ApiProperty({ example: '2026-01-31' })
  end_date: string;

  @ApiProperty({ example: '2026-01-25' })
  pay_date: string;

  @ApiPropertyOptional({ example: '2026-01-20' })
  cutoff_date?: string | null;
}

export class ListPayPeriodsResponseDto {
  @ApiProperty({ type: [PayPeriodResponseDto] })
  items: PayPeriodResponseDto[];
}
