import { ApiProperty } from '@nestjs/swagger';

export class FinancialSummaryDto {
  @ApiProperty()
  totalInvoiced: number;

  @ApiProperty()
  totalPaid: number;

  @ApiProperty()
  totalPending: number;

  @ApiProperty()
  invoiceCount: number;

  @ApiProperty()
  averageInvoiceAmount: number;
}

export class ContractorSummaryDto {
  @ApiProperty()
  totalContractors: number;

  @ApiProperty()
  activeContractors: number;

  @ApiProperty()
  inactiveContractors: number;

  @ApiProperty()
  activeEngagements: number;

  @ApiProperty()
  supplierCount: number;
}

export class ProjectSummaryDto {
  @ApiProperty()
  totalProjects: number;

  @ApiProperty()
  activeProjects: number;

  @ApiProperty()
  completedProjects: number;

  @ApiProperty()
  totalBudget: number;

  @ApiProperty()
  totalUtilized: number;

  @ApiProperty()
  averageUtilization: number;
}

export class TimesheetSummaryDto {
  @ApiProperty()
  totalTimesheets: number;

  @ApiProperty()
  pendingApproval: number;

  @ApiProperty()
  approved: number;

  @ApiProperty()
  rejected: number;

  @ApiProperty()
  totalHours: number;
}

export class TaxSummaryDto {
  @ApiProperty()
  totalWithheld: number;

  @ApiProperty()
  payeWithheld: number;

  @ApiProperty()
  sdlWithheld: number;

  @ApiProperty()
  uifWithheld: number;

  @ApiProperty()
  instructionCount: number;
}

export class DashboardAnalyticsDto {
  @ApiProperty({ type: FinancialSummaryDto })
  financial: FinancialSummaryDto;

  @ApiProperty({ type: ContractorSummaryDto })
  contractors: ContractorSummaryDto;

  @ApiProperty({ type: ProjectSummaryDto })
  projects: ProjectSummaryDto;

  @ApiProperty({ type: TimesheetSummaryDto })
  timesheets: TimesheetSummaryDto;

  @ApiProperty({ type: TaxSummaryDto })
  tax: TaxSummaryDto;
}
