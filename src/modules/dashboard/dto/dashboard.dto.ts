import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsUUID, IsDateString } from 'class-validator';

// ============================================================================
// Query DTOs
// ============================================================================

export class DashboardQueryDto {
  @ApiPropertyOptional({ description: 'Filter by legal entity' })
  @IsOptional()
  @IsUUID()
  legal_entity_id?: string;

  @ApiPropertyOptional({ description: 'Filter by pay group' })
  @IsOptional()
  @IsUUID()
  pay_group_id?: string;

  @ApiPropertyOptional({ description: 'Start date for period filter (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  from_date?: string;

  @ApiPropertyOptional({ description: 'End date for period filter (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  to_date?: string;
}

export class TrendQueryDto extends DashboardQueryDto {
  @ApiPropertyOptional({ description: 'Number of periods to include', default: 6 })
  @IsOptional()
  periods?: number;
}

// ============================================================================
// Summary Response DTOs
// ============================================================================

export class PayrollSummaryDto {
  @ApiProperty()
  total_gross: number;

  @ApiProperty()
  total_paye: number;

  @ApiProperty()
  total_deductions: number;

  @ApiProperty()
  total_net: number;

  @ApiProperty()
  total_employer_cost: number;

  @ApiProperty()
  employee_count: number;

  @ApiProperty()
  average_salary: number;
}

export class DepartmentBreakdownDto {
  @ApiProperty()
  department: string;

  @ApiProperty()
  employee_count: number;

  @ApiProperty()
  total_gross: number;

  @ApiProperty()
  total_net: number;

  @ApiProperty()
  percentage_of_total: number;
}

export class PayItemBreakdownDto {
  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  total_amount: number;

  @ApiProperty()
  employee_count: number;

  @ApiProperty()
  average_amount: number;
}

export class StatutoryTotalsDto {
  @ApiProperty()
  paye: number;

  @ApiProperty()
  uif_employee: number;

  @ApiProperty()
  uif_employer: number;

  @ApiProperty()
  sdl: number;

  @ApiProperty()
  total_statutory: number;
}

// ============================================================================
// Trend Response DTOs
// ============================================================================

export class PeriodTrendDto {
  @ApiProperty()
  period: string;

  @ApiProperty()
  period_start: string;

  @ApiProperty()
  period_end: string;

  @ApiProperty()
  total_gross: number;

  @ApiProperty()
  total_net: number;

  @ApiProperty()
  employee_count: number;

  @ApiProperty()
  average_salary: number;
}

export class PayrollTrendsDto {
  @ApiProperty({ type: [PeriodTrendDto] })
  periods: PeriodTrendDto[];

  @ApiProperty()
  gross_change_percent: number;

  @ApiProperty()
  headcount_change_percent: number;

  @ApiProperty()
  average_salary_change_percent: number;
}

// ============================================================================
// Status Response DTOs
// ============================================================================

export class PayRunStatusCountDto {
  @ApiProperty()
  status: string;

  @ApiProperty()
  count: number;
}

export class PendingApprovalsDto {
  @ApiProperty()
  total_pending: number;

  @ApiProperty()
  my_pending: number;

  @ApiProperty({ type: [Object] })
  items: {
    entity_type: string;
    entity_id: string;
    description: string;
    submitted_at: string;
    level: number;
  }[];
}

export class UpcomingPayrunsDto {
  @ApiProperty()
  payrun_id: string;

  @ApiProperty()
  pay_group_name: string;

  @ApiProperty()
  period_start: string;

  @ApiProperty()
  period_end: string;

  @ApiProperty()
  pay_date: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  employee_count: number;

  @ApiProperty()
  estimated_total: number;
}

// ============================================================================
// Full Dashboard Response
// ============================================================================

export class DashboardResponseDto {
  @ApiProperty({ type: PayrollSummaryDto })
  summary: PayrollSummaryDto;

  @ApiProperty({ type: [DepartmentBreakdownDto] })
  by_department: DepartmentBreakdownDto[];

  @ApiProperty({ type: StatutoryTotalsDto })
  statutory: StatutoryTotalsDto;

  @ApiProperty({ type: [PayRunStatusCountDto] })
  payrun_status: PayRunStatusCountDto[];

  @ApiProperty({ type: [UpcomingPayrunsDto] })
  upcoming_payruns: UpcomingPayrunsDto[];

  @ApiProperty()
  period_label: string;
}

export class AnalyticsResponseDto {
  @ApiProperty({ type: PayrollTrendsDto })
  trends: PayrollTrendsDto;

  @ApiProperty({ type: [PayItemBreakdownDto] })
  top_earnings: PayItemBreakdownDto[];

  @ApiProperty({ type: [PayItemBreakdownDto] })
  top_deductions: PayItemBreakdownDto[];

  @ApiProperty({ type: [DepartmentBreakdownDto] })
  department_comparison: DepartmentBreakdownDto[];
}

// ============================================================================
// Operational Dashboard Widget DTOs
// ============================================================================

export class WorkforceSummaryDto {
  @ApiProperty()
  employees: number;

  @ApiProperty()
  employments: number;

  @ApiProperty()
  org_units: number;

  @ApiProperty()
  cost_centers: number;

  @ApiProperty()
  legal_entities: number;

  @ApiProperty()
  positions: number;
}

export class PayrollSnapshotDto {
  @ApiPropertyOptional()
  current_period: { label: string; status: string } | null;

  @ApiProperty()
  pending_approvals: number;

  @ApiProperty()
  exceptions: number;

  @ApiProperty()
  payment_batches: number;

  @ApiPropertyOptional()
  next_pay_date: string | null;

  @ApiPropertyOptional()
  setup_required?: boolean;
}

export class ComplianceSnapshotDto {
  @ApiPropertyOptional()
  emp201?: { status: string; due_date?: string };

  @ApiPropertyOptional()
  irp5?: { status: string };

  @ApiProperty()
  alerts: number;

  @ApiProperty()
  tax_tables_configured: boolean;
}

export class DataImportsSummaryDto {
  @ApiPropertyOptional()
  latest_job: {
    id: string;
    name: string;
    status: string;
    submitted_at: string;
  } | null;

  @ApiProperty()
  rejected_rows: number;

  @ApiProperty()
  pending_jobs: number;
}

export class HrExportReadinessDto {
  @ApiProperty()
  status: 'READY' | 'READY_WITH_WARNINGS' | 'NOT_READY';

  @ApiProperty()
  exportable_employees: number;

  @ApiProperty()
  warnings: number;

  @ApiPropertyOptional()
  last_validated_at?: string;

  @ApiPropertyOptional({ type: [Object] })
  issues?: { code: string; count: number }[];

  @ApiPropertyOptional()
  manager_hierarchy?: {
    employees_total: number;
    manager_assigned: number;
    missing_manager: number;
    cycles_detected: number;
    status: string;
  };
}

// ============================================================================
// Aggregated Dashboard Summary (GET /dashboard/summary)
// ============================================================================

export class DashboardSummaryMetaDto {
  @ApiProperty()
  generated_at: string;

  @ApiProperty({ enum: ['GLOBAL', 'LEGAL_ENTITY', 'EMPTY'] })
  scope_mode: string;

  @ApiProperty()
  legal_entity_count: number;
}

export class DashboardSummaryResponseDto {
  @ApiProperty()
  widgets: Record<
    string,
    | { visible: false }
    | { visible: true; data: any }
  >;

  @ApiProperty({ type: DashboardSummaryMetaDto })
  meta: DashboardSummaryMetaDto;
}
