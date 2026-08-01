import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './services/analytics.service';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Analytics & Reports')
@ApiBearerAuth('bearerAuth')
@Controller('api/analytics')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // ==================== DASHBOARD METRICS ====================

  @Get('dashboard')
  @Permissions('analytics:dashboard:read')
  @ApiOperation({ summary: 'Get dashboard overview metrics' })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'legal_entity_id', required: false })
  @ApiResponse({ status: 200, description: 'Dashboard metrics' })
  async getDashboardOverview(
    @Query('country') country?: string,
    @Query('legal_entity_id') legalEntityId?: string,
  ) {
    return this.analyticsService.getDashboardOverview({
      country,
      legal_entity_id: legalEntityId,
    });
  }

  @Get('payroll/trends')
  @Permissions('analytics:payroll:read')
  @ApiOperation({ summary: 'Get payroll trends over time' })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'period', required: false, enum: ['monthly', 'quarterly', 'yearly'] })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Payroll trends data' })
  async getPayrollTrends(
    @Query('country') country?: string,
    @Query('period') period: 'monthly' | 'quarterly' | 'yearly' = 'monthly',
    @Query('limit') limit?: number,
  ) {
    return this.analyticsService.getPayrollTrends({
      country,
      period,
      limit: limit ? parseInt(limit.toString()) : undefined,
    });
  }

  @Get('departments')
  @Permissions('analytics:departments:read')
  @ApiOperation({ summary: 'Get department cost analysis' })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'legal_entity_id', required: false })
  @ApiResponse({ status: 200, description: 'Department analysis' })
  async getDepartmentAnalysis(
    @Query('country') country?: string,
    @Query('legal_entity_id') legalEntityId?: string,
  ) {
    return this.analyticsService.getDepartmentAnalysis({
      country,
      legal_entity_id: legalEntityId,
    });
  }

  @Get('tax/summary')
  @Permissions('analytics:tax:read')
  @ApiOperation({ summary: 'Get tax summary and breakdown' })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'date_from', required: false })
  @ApiQuery({ name: 'date_to', required: false })
  @ApiResponse({ status: 200, description: 'Tax summary' })
  async getTaxSummary(
    @Query('country') country?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    return this.analyticsService.getTaxSummary({
      country,
      date_from: dateFrom,
      date_to: dateTo,
    });
  }

  @Get('turnover')
  @Permissions('analytics:hr:read')
  @ApiOperation({ summary: 'Get employee turnover analysis' })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'period_months', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Turnover analysis' })
  async getTurnoverAnalysis(
    @Query('country') country?: string,
    @Query('period_months') periodMonths?: number,
  ) {
    return this.analyticsService.getTurnoverAnalysis({
      country,
      period_months: periodMonths ? parseInt(periodMonths.toString()) : undefined,
    });
  }

  @Get('expenses')
  @Permissions('analytics:expenses:read')
  @ApiOperation({ summary: 'Get expense analytics by category' })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'date_from', required: false })
  @ApiQuery({ name: 'date_to', required: false })
  @ApiResponse({ status: 200, description: 'Expense analytics' })
  async getExpenseAnalytics(
    @Query('country') country?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    return this.analyticsService.getExpenseAnalytics({
      country,
      date_from: dateFrom,
      date_to: dateTo,
    });
  }

  @Get('loans/portfolio')
  @Permissions('analytics:loans:read')
  @ApiOperation({ summary: 'Get loan portfolio summary' })
  @ApiQuery({ name: 'country', required: false })
  @ApiResponse({ status: 200, description: 'Loan portfolio' })
  async getLoanPortfolio(@Query('country') country?: string) {
    return this.analyticsService.getLoanPortfolio({ country });
  }

  @Get('performance')
  @Permissions('analytics:performance:read')
  @ApiOperation({ summary: 'Get performance review statistics' })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'cycle_id', required: false })
  @ApiResponse({ status: 200, description: 'Performance statistics' })
  async getPerformanceStats(
    @Query('country') country?: string,
    @Query('cycle_id') cycleId?: string,
  ) {
    return this.analyticsService.getPerformanceStats({
      country,
      cycle_id: cycleId,
    });
  }

  // ==================== SAVED REPORTS ====================

  @Post('reports/saved')
  @Permissions('analytics:reports:create')
  @ApiOperation({ summary: 'Create a saved report configuration' })
  @ApiResponse({ status: 201, description: 'Saved report created' })
  async createSavedReport(@Body() body: any) {
    return this.analyticsService.createSavedReport(body);
  }

  @Get('reports/saved')
  @Permissions('analytics:reports:read')
  @ApiOperation({ summary: 'Get saved reports' })
  @ApiQuery({ name: 'created_by', required: false })
  @ApiQuery({ name: 'report_type', required: false })
  @ApiResponse({ status: 200, description: 'List of saved reports' })
  async getSavedReports(
    @Query('created_by') createdBy?: string,
    @Query('report_type') reportType?: string,
  ) {
    return this.analyticsService.getSavedReports({
      created_by: createdBy,
      report_type: reportType,
    });
  }

  // ==================== KPIs ====================

  @Get('kpis')
  @Permissions('analytics:kpis:read')
  @ApiOperation({ summary: 'Get all active KPIs with current values' })
  @ApiQuery({ name: 'kpi_type', required: false })
  @ApiQuery({ name: 'country', required: false })
  @ApiResponse({ status: 200, description: 'List of KPIs' })
  async getKPIs(
    @Query('kpi_type') kpiType?: string,
    @Query('country') country?: string,
  ) {
    return this.analyticsService.getKPIs({
      kpi_type: kpiType,
      country,
    });
  }

  @Post('kpis/:id/update')
  @Permissions('analytics:kpis:update')
  @ApiOperation({ summary: 'Update KPI value' })
  @ApiResponse({ status: 200, description: 'KPI updated' })
  async updateKPI(
    @Param('id') id: string,
    @Body() body: { value: number },
  ) {
    await this.analyticsService.updateKPI(id, body.value);
    return { success: true };
  }
}
