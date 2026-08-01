import {
  Controller,
  Get,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import {
  DashboardQueryDto,
  TrendQueryDto,
  DashboardResponseDto,
  AnalyticsResponseDto,
  PayrollSummaryDto,
  DepartmentBreakdownDto,
  StatutoryTotalsDto,
  PayrollTrendsDto,
  PendingApprovalsDto,
  WorkforceSummaryDto,
  PayrollSnapshotDto,
  ComplianceSnapshotDto,
  DataImportsSummaryDto,
  HrExportReadinessDto,
} from './dto/dashboard.dto';
import { Permissions, AnyPermissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';

/**
 * Build scope from user's legal entity access.
 * - GLOBAL role users: legalEntityAccess contains all entities (from auth.service)
 * - LEGAL_ENTITY role users: legalEntityAccess contains assigned entities
 * - Empty = no assignments or bad data → treat as no access (return empty data), NOT platform-wide.
 */
function toScope(user: CurrentUserData): { legalEntityIds: string[] } {
  const ids = user?.legalEntityAccess ?? [];
  return { legalEntityIds: Array.isArray(ids) ? ids : [] };
}

function scopeMode(user: CurrentUserData): 'GLOBAL' | 'LEGAL_ENTITY' | 'EMPTY' {
  const ids = user?.legalEntityAccess ?? [];
  const count = Array.isArray(ids) ? ids.length : 0;
  if (count === 0) return 'EMPTY';
  return user?.hasGlobalScope ? 'GLOBAL' : 'LEGAL_ENTITY';
}

@ApiTags('Dashboard')
@ApiBearerAuth('bearerAuth')
@Controller('dashboard')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(private readonly dashboardService: DashboardService) {}

  private logScope(endpoint: string, user: CurrentUserData): void {
    const mode = scopeMode(user);
    const leCount = Array.isArray(user?.legalEntityAccess) ? user.legalEntityAccess.length : 0;
    this.logger.log(`${endpoint} userId=${user?.sub} scope=${mode} leCount=${leCount}`);
    // Future: consider debug level or sampling if logs become noisy
  }

  @Get()
  @Permissions('dashboard:read')
  @ApiOperation({ summary: 'Get main dashboard with summary, departments, and upcoming payruns' })
  @ApiResponse({ status: 200, description: 'Dashboard data', type: DashboardResponseDto })
  async getDashboard(@Query() query: DashboardQueryDto): Promise<DashboardResponseDto> {
    return this.dashboardService.getDashboard(query);
  }

  @Get('workforce-summary')
  @AnyPermissions('employee:read', 'employment:read')
  @ApiOperation({ summary: 'Get workforce snapshot (operational dashboard widget)' })
  @ApiResponse({ status: 200, description: 'Workforce summary', type: WorkforceSummaryDto })
  async getWorkforceSummary(@CurrentUser() user: CurrentUserData): Promise<WorkforceSummaryDto> {
    this.logScope('workforce-summary', user);
    return this.dashboardService.getWorkforceSummary(toScope(user));
  }

  @Get('payroll-summary')
  @AnyPermissions('payrun:read')
  @ApiOperation({ summary: 'Get payroll snapshot (operational dashboard widget)' })
  @ApiResponse({ status: 200, description: 'Payroll summary', type: PayrollSnapshotDto })
  async getPayrollSummarySnapshot(@CurrentUser() user: CurrentUserData): Promise<PayrollSnapshotDto> {
    this.logScope('payroll-summary', user);
    return this.dashboardService.getPayrollSnapshotSummary(toScope(user));
  }

  @Get('compliance-summary')
  @AnyPermissions('sars:irp5:read', 'sars:emp201:read', 'sars:emp501:read')
  @ApiOperation({ summary: 'Get compliance snapshot (operational dashboard widget)' })
  @ApiResponse({ status: 200, description: 'Compliance summary', type: ComplianceSnapshotDto })
  async getComplianceSummary(@CurrentUser() user: CurrentUserData): Promise<ComplianceSnapshotDto> {
    this.logScope('compliance-summary', user);
    return this.dashboardService.getComplianceSummary(toScope(user));
  }

  @Get('data-imports-summary')
  @AnyPermissions('data_import:read', 'data_import:write', 'data_import:approve', 'data_import:publish')
  @ApiOperation({ summary: 'Get data imports summary (operational dashboard widget)' })
  @ApiResponse({ status: 200, description: 'Data imports summary', type: DataImportsSummaryDto })
  async getDataImportsSummary(@CurrentUser() user: CurrentUserData): Promise<DataImportsSummaryDto> {
    this.logScope('data-imports-summary', user);
    return this.dashboardService.getDataImportsSummary();
  }

  @Get('hr-export-readiness')
  @AnyPermissions('hr:read', 'iam:legal_entities:manage')
  @ApiOperation({ summary: 'Get HR export / IGA readiness (operational dashboard widget)' })
  @ApiResponse({ status: 200, description: 'HR export readiness', type: HrExportReadinessDto })
  async getHrExportReadiness(@CurrentUser() user: CurrentUserData): Promise<HrExportReadinessDto> {
    this.logScope('hr-export-readiness', user);
    return this.dashboardService.getHrExportReadiness(toScope(user));
  }

  @Get('analytics')
  @Permissions('dashboard:read')
  @ApiOperation({ summary: 'Get analytics with trends and breakdowns' })
  @ApiResponse({ status: 200, description: 'Analytics data', type: AnalyticsResponseDto })
  async getAnalytics(@Query() query: TrendQueryDto): Promise<AnalyticsResponseDto> {
    return this.dashboardService.getAnalytics(query);
  }

  @Get('summary')
  @AnyPermissions(
    'iam:legal_entities:manage', 'legal_entity:read', 'employee:read', 'hr:read',
    'employment:read', 'payrun:read',
    'sars:irp5:read', 'sars:emp201:read', 'sars:emp501:read',
    'iam:users:manage', 'approval:approve', 'payrun:approve',
    'data_import:read', 'data_import:write', 'data_import:approve', 'data_import:publish',
    'iam:roles:manage', 'audit:events:read', // admin portal entry perms; may see no widgets
  )
  @ApiOperation({ summary: 'Get aggregated dashboard summary (all widgets, permission-filtered)' })
  @ApiResponse({ status: 200, description: 'Dashboard summary with widgets and meta' })
  async getDashboardSummary(@CurrentUser() user: CurrentUserData) {
    return this.dashboardService.getDashboardSummary(user);
  }

  @Get('totals')
  @Permissions('dashboard:read')
  @ApiOperation({ summary: 'Get payroll summary totals' })
  @ApiResponse({ status: 200, description: 'Payroll summary', type: PayrollSummaryDto })
  async getPayrollTotals(@Query() query: DashboardQueryDto): Promise<PayrollSummaryDto> {
    const { fromDate, toDate } = this.resolveDateRange(query);
    return this.dashboardService.getPayrollSummary(query, fromDate, toDate);
  }

  @Get('by-department')
  @Permissions('dashboard:read')
  @ApiOperation({ summary: 'Get payroll breakdown by department' })
  @ApiResponse({ status: 200, description: 'Department breakdown', type: [DepartmentBreakdownDto] })
  async getByDepartment(@Query() query: DashboardQueryDto): Promise<DepartmentBreakdownDto[]> {
    const { fromDate, toDate } = this.resolveDateRange(query);
    return this.dashboardService.getDepartmentBreakdown(query, fromDate, toDate);
  }

  @Get('statutory')
  @Permissions('dashboard:read')
  @ApiOperation({ summary: 'Get statutory deduction totals (PAYE, UIF, SDL)' })
  @ApiResponse({ status: 200, description: 'Statutory totals', type: StatutoryTotalsDto })
  async getStatutory(@Query() query: DashboardQueryDto): Promise<StatutoryTotalsDto> {
    const { fromDate, toDate } = this.resolveDateRange(query);
    return this.dashboardService.getStatutoryTotals(query, fromDate, toDate);
  }

  @Get('trends')
  @Permissions('dashboard:read')
  @ApiOperation({ summary: 'Get payroll trends over time' })
  @ApiResponse({ status: 200, description: 'Payroll trends', type: PayrollTrendsDto })
  async getTrends(@Query() query: TrendQueryDto): Promise<PayrollTrendsDto> {
    return this.dashboardService.getPayrollTrends(query, query.periods || 6);
  }

  @Get('pending-approvals')
  @AnyPermissions('iam:users:manage', 'approval:approve', 'payrun:approve')
  @ApiOperation({ summary: 'Get pending approvals summary' })
  @ApiResponse({ status: 200, description: 'Pending approvals', type: PendingApprovalsDto })
  async getPendingApprovals(
    @CurrentUser() user: CurrentUserData,
  ): Promise<PendingApprovalsDto> {
    this.logScope('pending-approvals', user);
    return this.dashboardService.getPendingApprovals(user.sub, toScope(user));
  }

  private resolveDateRange(query: DashboardQueryDto): { fromDate: Date; toDate: Date } {
    if (query.from_date && query.to_date) {
      return {
        fromDate: new Date(query.from_date),
        toDate: new Date(query.to_date),
      };
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return { fromDate: startOfMonth, toDate: endOfMonth };
  }
}
