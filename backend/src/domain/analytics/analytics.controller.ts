import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import {
  DashboardAnalyticsDto,
  FinancialSummaryDto,
  ContractorSummaryDto,
  ProjectSummaryDto,
  TimesheetSummaryDto,
  TaxSummaryDto,
} from './dto/analytics-response.dto';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { Permissions } from '../../core/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../../core/auth/guards/permissions.guard';
import { CurrentAccessContext } from '../../core/auth/decorators/current-access-context.decorator';
import { RequiresOrgContext } from '../../core/auth/decorators/org-context.decorator';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @Permissions('analytics:read')
  @RequiresOrgContext({ type: 'query', key: 'organizationId' })
  @ApiOperation({ summary: 'Get comprehensive dashboard analytics' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard analytics retrieved successfully',
    type: DashboardAnalyticsDto,
  })
  async getDashboardAnalytics(
    @CurrentAccessContext() accessContext: AccessContext,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<DashboardAnalyticsDto> {
    return this.analyticsService.getDashboardAnalytics(
      accessContext,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('financial')
  @Permissions('analytics:read')
  @RequiresOrgContext({ type: 'query', key: 'organizationId' })
  @ApiOperation({ summary: 'Get financial summary' })
  @ApiResponse({
    status: 200,
    description: 'Financial summary retrieved successfully',
    type: FinancialSummaryDto,
  })
  async getFinancialSummary(
    @CurrentAccessContext() accessContext: AccessContext,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<FinancialSummaryDto> {
    return this.analyticsService.getFinancialSummary(
      accessContext,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('contractors')
  @Permissions('analytics:read')
  @RequiresOrgContext({ type: 'query', key: 'organizationId' })
  @ApiOperation({ summary: 'Get contractor summary' })
  @ApiResponse({
    status: 200,
    description: 'Contractor summary retrieved successfully',
    type: ContractorSummaryDto,
  })
  async getContractorSummary(
    @CurrentAccessContext() accessContext: AccessContext,
  ): Promise<ContractorSummaryDto> {
    return this.analyticsService.getContractorSummary(accessContext);
  }

  @Get('projects')
  @Permissions('analytics:read')
  @RequiresOrgContext({ type: 'query', key: 'organizationId' })
  @ApiOperation({ summary: 'Get project summary' })
  @ApiResponse({
    status: 200,
    description: 'Project summary retrieved successfully',
    type: ProjectSummaryDto,
  })
  async getProjectSummary(
    @CurrentAccessContext() accessContext: AccessContext,
  ): Promise<ProjectSummaryDto> {
    return this.analyticsService.getProjectSummary(accessContext);
  }

  @Get('timesheets')
  @Permissions('analytics:read')
  @RequiresOrgContext({ type: 'query', key: 'organizationId' })
  @ApiOperation({ summary: 'Get timesheet summary' })
  @ApiResponse({
    status: 200,
    description: 'Timesheet summary retrieved successfully',
    type: TimesheetSummaryDto,
  })
  async getTimesheetSummary(
    @CurrentAccessContext() accessContext: AccessContext,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<TimesheetSummaryDto> {
    return this.analyticsService.getTimesheetSummary(
      accessContext,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('tax')
  @Permissions('analytics:read')
  @RequiresOrgContext({ type: 'query', key: 'organizationId' })
  @ApiOperation({ summary: 'Get tax and withholding summary' })
  @ApiResponse({
    status: 200,
    description: 'Tax summary retrieved successfully',
    type: TaxSummaryDto,
  })
  async getTaxSummary(
    @CurrentAccessContext() accessContext: AccessContext,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<TaxSummaryDto> {
    return this.analyticsService.getTaxSummary(
      accessContext,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }
}
