import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Country } from '../../../common/dto/enums.dto';

export class TaxBracketDto {
  @ApiProperty({ example: 0 })
  from_amount: number;

  @ApiPropertyOptional({ example: 237100, nullable: true })
  to_amount: number | null;

  @ApiProperty({ example: 0.18 })
  rate: number;

  @ApiPropertyOptional({ example: 0, nullable: true })
  base_tax: number | null;
}

export class TaxTableResponseDto {
  @ApiProperty({ enum: Country, example: Country.ZA })
  country: Country;

  @ApiProperty({ example: '2024-03-01' })
  effective_from: string;

  @ApiPropertyOptional({ example: '2025-02-28' })
  effective_to?: string | null;

  @ApiProperty({ type: [TaxBracketDto] })
  brackets: TaxBracketDto[];

  @ApiPropertyOptional({
    description: 'Country-specific metadata (e.g., LS credit, ZA rebates/thresholds)',
    example: {
      primary_rebate: 17235,
      secondary_rebate: 9444,
      tax_threshold_under_65: 95750,
    },
  })
  meta?: Record<string, any> | null;
}

export class ImportTaxTableResponseDto {
  @ApiProperty({ example: 'job_tax_import_123' })
  job_id: string;

  @ApiPropertyOptional({ example: 'tt_123' })
  import_id?: string | null;
}
