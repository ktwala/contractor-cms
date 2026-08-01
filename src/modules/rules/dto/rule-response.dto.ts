import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Country, RoundingMode } from '../../../common/dto/enums.dto';

export class RuleResponseDto {
  @ApiProperty({ example: 'rl_1' })
  id: string;

  @ApiProperty({ example: 'TAXABLE_INCOME' })
  code: string;

  @ApiProperty({ example: 'Calculate Taxable Income' })
  name: string;

  @ApiPropertyOptional({ enum: Country })
  country?: Country | null;

  @ApiProperty({ example: 'GROSS - PENSION_DEDUCTION - MEDICAL_AID' })
  expression: string;

  @ApiPropertyOptional({ type: [String] })
  dependencies?: string[];

  @ApiPropertyOptional()
  rounding?: {
    mode?: RoundingMode;
    decimals?: number;
  };

  @ApiProperty({ example: '2024-03-01' })
  effective_from: string;

  @ApiPropertyOptional({ example: '2025-02-28' })
  effective_to?: string | null;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  created_at: string;
}

export class ListRulesResponseDto {
  @ApiProperty({ type: [RuleResponseDto] })
  items: RuleResponseDto[];
}
