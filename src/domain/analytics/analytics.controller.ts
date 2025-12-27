import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
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
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @Permissions('analytics:read')
  @ApiOperation({ summary: 'Get comprehensive dashboard analytics' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Filter start date (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filter end date (ISO 8601)' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard analytics data',
    type: DashboardAnalyticsDto,
  })
  async getDashboard(
    @CurrentUser('organizationId') organizationId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<DashboardAnalyticsDto> {
    return this.analyticsService.getDashboardAnalytics(
      organizationId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('financial')
  @Permissions('analytics:read')
  @ApiOperation({ summary: 'Get financial summary' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Filter start date (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filter end date (ISO 8601)' })
  @ApiResponse({
    status: 200,
    description: 'Financial summary',
    type: FinancialSummaryDto,
  })
  async getFinancial(
    @CurrentUser('organizationId') organizationId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<FinancialSummaryDto> {
    return this.analyticsService.getFinancialSummary(
      organizationId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('contractors')
  @Permissions('analytics:read')
  @ApiOperation({ summary: 'Get contractor summary' })
  @ApiResponse({
    status: 200,
    description: 'Contractor summary',
    type: ContractorSummaryDto,
  })
  async getContractors(
    @CurrentUser('organizationId') organizationId: string,
  ): Promise<ContractorSummaryDto> {
    return this.analyticsService.getContractorSummary(organizationId);
  }

  @Get('projects')
  @Permissions('analytics:read')
  @ApiOperation({ summary: 'Get project summary' })
  @ApiResponse({
    status: 200,
    description: 'Project summary',
    type: ProjectSummaryDto,
  })
  async getProjects(
    @CurrentUser('organizationId') organizationId: string,
  ): Promise<ProjectSummaryDto> {
    return this.analyticsService.getProjectSummary(organizationId);
  }

  @Get('timesheets')
  @Permissions('analytics:read')
  @ApiOperation({ summary: 'Get timesheet summary' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Filter start date (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filter end date (ISO 8601)' })
  @ApiResponse({
    status: 200,
    description: 'Timesheet summary',
    type: TimesheetSummaryDto,
  })
  async getTimesheets(
    @CurrentUser('organizationId') organizationId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<TimesheetSummaryDto> {
    return this.analyticsService.getTimesheetSummary(
      organizationId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('tax')
  @Permissions('analytics:read')
  @ApiOperation({ summary: 'Get tax withholding summary' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Filter start date (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filter end date (ISO 8601)' })
  @ApiResponse({
    status: 200,
    description: 'Tax summary',
    type: TaxSummaryDto,
  })
  async getTax(
    @CurrentUser('organizationId') organizationId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<TaxSummaryDto> {
    return this.analyticsService.getTaxSummary(
      organizationId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }
}
