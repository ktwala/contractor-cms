import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PayRunStatus, PayRunType, AdjustmentMode, Country, Currency } from '../../../common/dto/enums.dto';

export class PayRunResponseDto {
  @ApiProperty({ example: 'pr_456' })
  id: string;

  @ApiProperty({ example: 'pg_za_123' })
  pay_group_id: string;

  @ApiPropertyOptional({ example: 'pp_za_2026_01' })
  period_id?: string | null;

  @ApiPropertyOptional({ example: '2026-01-01' })
  period_start?: string | null;

  @ApiPropertyOptional({ example: '2026-01-31' })
  period_end?: string | null;

  @ApiPropertyOptional({ example: '2026-01-25' })
  pay_date?: string | null;

  @ApiProperty({ enum: PayRunStatus, example: PayRunStatus.DRAFT })
  status: PayRunStatus;

  @ApiProperty({ enum: PayRunType, example: PayRunType.REGULAR })
  payrun_type: PayRunType;

  @ApiPropertyOptional({ example: 'pr_123' })
  base_payrun_id?: string | null;

  @ApiPropertyOptional()
  adjustment_reason?: string | null;

  @ApiPropertyOptional({ enum: AdjustmentMode })
  adjustment_mode?: AdjustmentMode | null;

  @ApiPropertyOptional()
  notes?: string | null;

  @ApiPropertyOptional()
  approved_by?: string | null;

  @ApiPropertyOptional()
  approved_at?: string | null;

  @ApiPropertyOptional()
  locked_at?: string | null;

  @ApiPropertyOptional()
  last_calculated_at?: string | null;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  created_at: string;
}

export class PaginatedPayRunsDto {
  @ApiProperty({ type: [PayRunResponseDto] })
  items: PayRunResponseDto[];

  @ApiProperty({ example: 0 })
  offset: number;

  @ApiProperty({ example: 50 })
  limit: number;

  @ApiProperty({ example: 25 })
  total: number;
}

export class PayRunContextDto {
  @ApiProperty({ example: 'pr_456' })
  payrun_id: string;

  @ApiProperty({ example: 'pg_za_123' })
  pay_group_id: string;

  @ApiProperty({ enum: Country, example: Country.ZA })
  country: Country;

  @ApiProperty({ enum: Currency, example: Currency.ZAR })
  currency: Currency;

  @ApiProperty({ example: 'le_za_001' })
  legal_entity_id: string;

  @ApiPropertyOptional({ example: 'za-pack@1.0.3' })
  pack_version?: string | null;

  @ApiPropertyOptional()
  tax_table?: {
    effective_from: string;
    effective_to?: string | null;
    table_id?: string | null;
    meta?: Record<string, any>;
  } | null;

  @ApiPropertyOptional()
  rounding_policy?: Record<string, any> | null;

  @ApiPropertyOptional()
  created_at?: string | null;
}

export class LockRulesResponseDto {
  @ApiProperty({ example: 'pr_456' })
  payrun_id: string;

  @ApiProperty({ enum: PayRunStatus })
  status: PayRunStatus;

  @ApiProperty()
  rules: {
    can_add_employees: boolean;
    can_remove_employees: boolean;
    can_add_inputs: boolean;
    can_calculate: boolean;
    can_submit: boolean;
    can_approve: boolean;
    can_revert: boolean;
    can_mark_paid: boolean;
    can_mark_posted: boolean;
    can_finalize: boolean;
    can_create_adjustment: boolean;
  };

  @ApiPropertyOptional({ description: 'True when the linked pay period is closed (GOV-3D-1).' })
  period_closed?: boolean;
}

export class PayRunTotalsDto {
  @ApiProperty({ example: 250000.0 })
  gross: number;

  @ApiProperty({ example: 230000.0 })
  taxable_income: number;

  @ApiProperty({ example: 45000.0 })
  paye: number;

  @ApiProperty({ example: 50000.0 })
  deductions: number;

  @ApiProperty({ example: 200000.0 })
  net: number;
}

export class PayRunSummaryDto {
  @ApiProperty({ example: 'pr_456' })
  payrun_id: string;

  @ApiProperty({ example: 50, description: 'Count of persisted calculation rows (employee_results).' })
  employee_count: number;

  @ApiProperty({
    example: 50,
    description: 'Count of included payrun register rows (payrun_employees). Populated after snapshot.',
  })
  register_employee_count: number;

  @ApiProperty({ type: PayRunTotalsDto })
  totals: PayRunTotalsDto;
}
