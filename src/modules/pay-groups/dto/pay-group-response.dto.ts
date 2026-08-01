import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Country, Currency, PayFrequency } from '../../../common/dto/enums.dto';

export class PayGroupResponseDto {
  @ApiProperty({ example: 'pg_za_123' })
  id: string;

  @ApiProperty({ example: 'ZA-MONTHLY-SALARIED' })
  code: string;

  @ApiProperty({ example: 'South Africa Monthly Salaried' })
  name: string;

  @ApiProperty({ enum: Country, example: Country.ZA })
  country: Country;

  @ApiProperty({ enum: Currency, example: Currency.ZAR })
  currency: Currency;

  @ApiProperty({ enum: PayFrequency, example: PayFrequency.MONTHLY })
  frequency: PayFrequency;

  @ApiProperty({ example: 'le_za_001' })
  legal_entity_id: string;

  @ApiPropertyOptional()
  default_calendar?: {
    cutoff_day?: number;
    pay_day?: number;
  };

  @ApiPropertyOptional()
  gl_defaults?: {
    suspense_account?: string;
  };

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  created_at: string;
}

export class ListPayGroupsResponseDto {
  @ApiProperty({ type: [PayGroupResponseDto] })
  items: PayGroupResponseDto[];
}
