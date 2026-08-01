import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  Res,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { GovernancePolicyDraftStatus } from '@prisma/client';
import { Response } from 'express';
import { PayrollCalendarService, PayrollCalendar, PayrollPeriod } from './services/payroll-calendar.service';
import { PayrollChecklistService } from './services/payroll-checklist.service';
import { PayrollExceptionsService } from './services/payroll-exceptions.service';
import { PayrollReconciliationService } from './services/payroll-reconciliation.service';
import { PayrollForecastingService } from './services/payroll-forecasting.service';
import { PayrollPeriodCloseGateService } from './services/payroll-period-close-gate.service';
import { PayrollGovernancePortfolioService } from './services/payroll-governance-portfolio.service';
import type { PortfolioGateUser } from './services/payroll-governance-portfolio.service';
import { PayrollGovernancePortfolioEvidenceExportService } from './services/payroll-governance-portfolio-evidence-export.service';
import { GovernancePolicyScope } from '@prisma/client';
import type { GovernancePolicyImpactPreviewRequestDto } from './dto/governance-policy-impact.dto';
import {
  PayrollGovernancePolicyService,
  type CreateGovernancePolicyVersionInput,
} from './services/payroll-governance-policy.service';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Controller('api/payroll-cycle')
@UseGuards(AuthGuard('jwt'))
export class PayrollCycleController {
  constructor(
    private readonly calendarService: PayrollCalendarService,
    private readonly checklistService: PayrollChecklistService,
    private readonly exceptionsService: PayrollExceptionsService,
    private readonly reconciliationService: PayrollReconciliationService,
    private readonly forecastingService: PayrollForecastingService,
    private readonly periodCloseGate: PayrollPeriodCloseGateService,
    private readonly governancePortfolio: PayrollGovernancePortfolioService,
    private readonly governancePortfolioEvidence: PayrollGovernancePortfolioEvidenceExportService,
    private readonly governancePolicy: PayrollGovernancePolicyService,
  ) {}

  private portfolioUser(req: { user: PortfolioGateUser & { userId?: string } }): PortfolioGateUser {
    const u = req.user;
    return {
      sub: String(u.sub ?? u.userId ?? ''),
      permissions: u.permissions,
      legalEntityAccess: u.legalEntityAccess,
      hasGlobalScope: u.hasGlobalScope,
    };
  }

  private evidenceGeneratedBy(req: any): string {
    const u = req.user ?? {};
    const sub = String(u.sub ?? u.userId ?? 'unknown');
    const email = u.email;
    return typeof email === 'string' && email.length > 0 ? `${email} (${sub})` : sub;
  }

  private parseEvidenceFormat(format?: string): 'csv' | 'xlsx' {
    const f = (format ?? 'csv').toLowerCase();
    if (f === 'csv' || f === 'xlsx') return f;
    throw new BadRequestException({
      code: 'UNSUPPORTED_FORMAT',
      message: 'format query must be csv or xlsx',
    });
  }

  // ==========================================
  // CALENDAR & PERIOD MANAGEMENT
  // ==========================================

  @Post('calendars')
  @Permissions('payroll:calendars:create')
  async createCalendar(@Body() body: any, @Request() req: any) {
    const calendarId = await this.calendarService.createCalendar(
      body.calendar_name,
      body.legal_entity_id,
      body.frequency,
      body.start_date,
      body.end_date || null,
      body.calendar_config || {},
      req.user.userId,
    );
    return { calendar_id: calendarId };
  }

  @Post('calendars/:calendarId/generate-periods')
  @Permissions('payroll:calendars:manage')
  async generatePeriods(
    @Param('calendarId') calendarId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    const periodIds = await this.calendarService.generatePeriods(
      calendarId,
      body.number_of_periods || 12,
      req.user.userId,
    );
    return { period_ids: periodIds, count: periodIds.length };
  }

  @Get('calendars')
  @Permissions('payroll:calendars:view')
  async getCalendars(@Query('legal_entity_id') legalEntityId: string): Promise<PayrollCalendar[]> {
    return this.calendarService.getCalendars(legalEntityId);
  }

  @Get('calendars/:calendarId/periods')
  @Permissions('payroll:periods:view')
  async getPeriodsForCalendar(
    @Param('calendarId') calendarId: string,
    @Query('year') year?: number,
  ) {
    return this.calendarService.getPeriodsForPayGroup(calendarId, year);
  }

  @Get('periods/current')
  @Permissions('payroll:periods:view')
  async getCurrentPeriod(@Query('legal_entity_id') legalEntityId: string) {
    return this.calendarService.getCurrentPeriod(legalEntityId);
  }

  @Get('periods/upcoming')
  @Permissions('payroll:periods:view')
  async getUpcomingPeriods(
    @Query('legal_entity_id') legalEntityId: string,
    @Query('limit') limit?: number,
  ): Promise<PayrollPeriod[]> {
    return this.calendarService.getUpcomingPeriods(legalEntityId, limit || 12);
  }

  @Get('periods/:periodId')
  @Permissions('payroll:periods:view')
  async getPeriodById(@Param('periodId') periodId: string) {
    return this.calendarService.getPeriodById(periodId);
  }

  @Post('periods/:periodId/lock')
  @Permissions('payroll:periods:lock')
  async lockPeriod(@Param('periodId') periodId: string, @Request() req: any) {
    await this.calendarService.lockPeriod(periodId, req.user.userId);
    return { status: 'locked' };
  }

  @Post('periods/:periodId/unlock')
  @Permissions('payroll:periods:unlock')
  async unlockPeriod(@Param('periodId') periodId: string, @Request() req: any) {
    await this.calendarService.unlockPeriod(periodId, req.user.userId);
    return { status: 'unlocked' };
  }

  @Put('periods/:periodId/status')
  @Permissions('payroll:periods:manage')
  async updatePeriodStatus(@Param('periodId') periodId: string, @Body() body: any) {
    await this.calendarService.updatePeriodStatus(periodId, body.status);
    return { status: body.status };
  }

  @Post('periods/:periodId/close')
  @Permissions('payroll:periods:close')
  async closePeriod(
    @Param('periodId') periodId: string,
    @Request() req: any,
    @Headers() hdrs?: Record<string, string | string[] | undefined>,
  ) {
    const user = {
      sub: req.user?.sub ?? req.user?.userId,
      permissions: req.user?.permissions as string[] | undefined,
    };
    await this.periodCloseGate.assertAllowsPeriodClose(periodId, user, hdrs ?? {});
    await this.calendarService.closePeriod(periodId, user.sub);
    return { status: 'closed' };
  }

  // ==========================================
  // GOV-5B — Governance portfolio (period / pay group / legal entity)
  // ==========================================

  @Get('governance-portfolio/periods/:periodId')
  @UseGuards(PermissionsGuard)
  @Permissions('payrun:read')
  async getGovernancePortfolioForPeriod(@Param('periodId') periodId: string, @Request() req: any) {
    return this.governancePortfolio.summarizePeriod(periodId, this.portfolioUser(req));
  }

  @Get('governance-portfolio/pay-groups/:payGroupId')
  @UseGuards(PermissionsGuard)
  @Permissions('payrun:read')
  async getGovernancePortfolioForPayGroup(@Param('payGroupId') payGroupId: string, @Request() req: any) {
    return this.governancePortfolio.summarizePayGroup(payGroupId, this.portfolioUser(req));
  }

  @Get('governance-portfolio/legal-entities/:legalEntityId')
  @UseGuards(PermissionsGuard)
  @Permissions('payrun:read')
  async getGovernancePortfolioForLegalEntity(@Param('legalEntityId') legalEntityId: string, @Request() req: any) {
    return this.governancePortfolio.summarizeLegalEntity(legalEntityId, this.portfolioUser(req));
  }

  // GOV-5C — Evidence export (same access as portfolio JSON)
  @Get('governance-portfolio/periods/:periodId/export')
  @UseGuards(PermissionsGuard)
  @Permissions('payrun:read')
  async exportGovernancePortfolioPeriod(
    @Param('periodId') periodId: string,
    @Query('format') format: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const fmt = this.parseEvidenceFormat(format);
    const { buffer, filename, contentType } = await this.governancePortfolioEvidence.exportPeriodEvidence(
      periodId,
      this.portfolioUser(req),
      this.evidenceGeneratedBy(req),
      fmt,
    );
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('governance-portfolio/pay-groups/:payGroupId/export')
  @UseGuards(PermissionsGuard)
  @Permissions('payrun:read')
  async exportGovernancePortfolioPayGroup(
    @Param('payGroupId') payGroupId: string,
    @Query('format') format: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const fmt = this.parseEvidenceFormat(format);
    const { buffer, filename, contentType } = await this.governancePortfolioEvidence.exportPayGroupEvidence(
      payGroupId,
      this.portfolioUser(req),
      this.evidenceGeneratedBy(req),
      fmt,
    );
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  // GOV-6A / GOV-6C — Governance policy registry (admin UI + version history use payrun:admin only)
  @Get('governance-policies/history')
  @UseGuards(PermissionsGuard)
  @Permissions('payrun:admin')
  async listGovernancePolicyHistory(
    @Query('policy_key') policyKey: string,
    @Query('scope') scope: string,
    @Query('legal_entity_id') legalEntityId: string | undefined,
    @Query('pay_group_id') payGroupId: string | undefined,
    @Request() req: any,
  ) {
    return this.governancePolicy.listPolicyVersionHistory(this.portfolioUser(req), {
      policy_key: policyKey,
      scope: scope as GovernancePolicyScope,
      legal_entity_id: legalEntityId,
      pay_group_id: payGroupId,
    });
  }

  @Get('governance-policies')
  @UseGuards(PermissionsGuard)
  @Permissions('payrun:admin')
  async listGovernancePolicies(
    @Query('legal_entity_id') legalEntityId: string | undefined,
    @Query('pay_group_id') payGroupId: string | undefined,
    @Request() req: any,
  ) {
    return this.governancePolicy.listCurrentPolicies(this.portfolioUser(req), {
      legal_entity_id: legalEntityId,
      pay_group_id: payGroupId,
    });
  }

  @Post('governance-policies/impact-preview')
  @UseGuards(PermissionsGuard)
  @Permissions('payrun:admin')
  async governancePolicyImpactPreview(@Body() body: GovernancePolicyImpactPreviewRequestDto, @Request() req: any) {
    const actorUserId = String(req.user?.userId ?? req.user?.sub ?? '');
    return this.governancePolicy.governancePolicyImpactPreview(this.portfolioUser(req), actorUserId, body);
  }

  @Get('governance-policies/drafts')
  @UseGuards(PermissionsGuard)
  @Permissions('payrun:admin')
  async listGovernancePolicyDrafts(
    @Query('legal_entity_id') legalEntityId: string | undefined,
    @Query('pay_group_id') payGroupId: string | undefined,
    @Query('status') status: string | undefined,
    @Request() req: any,
  ) {
    let st: GovernancePolicyDraftStatus | undefined;
    if (status) {
      if (!Object.values(GovernancePolicyDraftStatus).includes(status as GovernancePolicyDraftStatus)) {
        throw new BadRequestException({ code: 'INVALID_DRAFT_STATUS', message: 'Invalid draft status filter' });
      }
      st = status as GovernancePolicyDraftStatus;
    }
    return this.governancePolicy.listGovernancePolicyDrafts(this.portfolioUser(req), {
      legal_entity_id: legalEntityId,
      pay_group_id: payGroupId,
      status: st,
    });
  }

  @Post('governance-policies/drafts')
  @UseGuards(PermissionsGuard)
  @Permissions('payrun:admin')
  async createGovernancePolicyDraft(@Body() body: CreateGovernancePolicyVersionInput, @Request() req: any) {
    const actorUserId = String(req.user?.userId ?? req.user?.sub ?? '');
    return this.governancePolicy.createGovernancePolicyDraft(this.portfolioUser(req), actorUserId, body);
  }

  @Post('governance-policies/drafts/:draftId/approve')
  @UseGuards(PermissionsGuard)
  @Permissions('payrun:admin')
  async approveGovernancePolicyDraft(@Param('draftId') draftId: string, @Request() req: any) {
    const actorUserId = String(req.user?.userId ?? req.user?.sub ?? '');
    return this.governancePolicy.approveGovernancePolicyDraft(this.portfolioUser(req), actorUserId, draftId);
  }

  @Post('governance-policies/drafts/:draftId/reject')
  @UseGuards(PermissionsGuard)
  @Permissions('payrun:admin')
  async rejectGovernancePolicyDraft(@Param('draftId') draftId: string, @Request() req: any) {
    const actorUserId = String(req.user?.userId ?? req.user?.sub ?? '');
    return this.governancePolicy.rejectGovernancePolicyDraft(this.portfolioUser(req), actorUserId, draftId);
  }

  @Post('governance-policies/drafts/:draftId/cancel')
  @UseGuards(PermissionsGuard)
  @Permissions('payrun:admin')
  async cancelGovernancePolicyDraft(@Param('draftId') draftId: string, @Request() req: any) {
    const actorUserId = String(req.user?.userId ?? req.user?.sub ?? '');
    return this.governancePolicy.cancelGovernancePolicyDraft(this.portfolioUser(req), actorUserId, draftId);
  }

  @Post('governance-policies/drafts/:draftId/activate')
  @UseGuards(PermissionsGuard)
  @Permissions('payrun:admin')
  async activateGovernancePolicyDraft(@Param('draftId') draftId: string, @Request() req: any) {
    const actorUserId = String(req.user?.userId ?? req.user?.sub ?? '');
    return this.governancePolicy.activateGovernancePolicyDraft(this.portfolioUser(req), actorUserId, draftId);
  }

  @Post('governance-policies')
  @UseGuards(PermissionsGuard)
  @Permissions('payrun:admin')
  async createGovernancePolicyVersion(@Body() body: CreateGovernancePolicyVersionInput, @Request() req: any) {
    const actorUserId = String(req.user?.userId ?? req.user?.sub ?? '');
    return this.governancePolicy.createPolicyVersion(this.portfolioUser(req), actorUserId, body);
  }

  @Get('governance-portfolio/legal-entities/:legalEntityId/export')
  @UseGuards(PermissionsGuard)
  @Permissions('payrun:read')
  async exportGovernancePortfolioLegalEntity(
    @Param('legalEntityId') legalEntityId: string,
    @Query('format') format: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const fmt = this.parseEvidenceFormat(format);
    const { buffer, filename, contentType } = await this.governancePortfolioEvidence.exportLegalEntityEvidence(
      legalEntityId,
      this.portfolioUser(req),
      this.evidenceGeneratedBy(req),
      fmt,
    );
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  // ==========================================
  // CHECKLIST MANAGEMENT
  // ==========================================

  @Post('periods/:periodId/checklist')
  @Permissions('payroll:checklists:create')
  async createChecklistFromTemplate(
    @Param('periodId') periodId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    const checklistId = await this.checklistService.createChecklistFromTemplate(
      periodId,
      body.template_id,
      req.user.userId,
    );
    return { checklist_id: checklistId };
  }

  @Get('periods/:periodId/checklist')
  @Permissions('payroll:checklists:view')
  async getChecklistForPeriod(@Param('periodId') periodId: string) {
    return this.checklistService.getChecklistForPeriod(periodId);
  }

  @Post('checklist-tasks/:taskId/complete')
  @Permissions('payroll:checklists:complete')
  async completeTask(
    @Param('taskId') taskId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    await this.checklistService.completeTask(taskId, req.user.userId, body.notes || null);
    return { status: 'completed' };
  }

  @Post('checklist-tasks/:taskId/assign')
  @Permissions('payroll:checklists:assign')
  async assignTask(@Param('taskId') taskId: string, @Body() body: any) {
    await this.checklistService.assignTask(taskId, body.user_id);
    return { status: 'assigned' };
  }

  @Get('checklist-tasks/my-tasks')
  @Permissions('payroll:checklists:view')
  async getMyTasks(@Request() req: any) {
    return this.checklistService.getMyTasks(req.user.userId);
  }

  // ==========================================
  // EXCEPTIONS MANAGEMENT
  // ==========================================

  @Post('periods/:periodId/detect-exceptions')
  @Permissions('payroll:exceptions:detect')
  async detectExceptions(
    @Param('periodId') periodId: string,
    @Body() body: any,
  ) {
    const count = await this.exceptionsService.detectExceptions(periodId, body.payrun_id);
    return { exceptions_detected: count };
  }

  @Get('periods/:periodId/exceptions')
  @Permissions('payroll:exceptions:view')
  async getExceptionsForPeriod(
    @Param('periodId') periodId: string,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
  ) {
    return this.exceptionsService.getExceptionsForPeriod(periodId, status, severity);
  }

  @Post('exceptions/:exceptionId/resolve')
  @Permissions('payroll:exceptions:resolve')
  async resolveException(
    @Param('exceptionId') exceptionId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    await this.exceptionsService.resolveException(
      exceptionId,
      req.user.userId,
      body.resolution_notes,
    );
    return { status: 'resolved' };
  }

  @Post('exceptions/:exceptionId/dismiss')
  @Permissions('payroll:exceptions:dismiss')
  async dismissException(
    @Param('exceptionId') exceptionId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    await this.exceptionsService.dismissException(
      exceptionId,
      req.user.userId,
      body.reason,
    );
    return { status: 'dismissed' };
  }

  @Get('periods/:periodId/exceptions/stats')
  @Permissions('payroll:exceptions:view')
  async getExceptionStats(@Param('periodId') periodId: string) {
    return this.exceptionsService.getExceptionStats(periodId);
  }

  // ==========================================
  // RECONCILIATION
  // ==========================================

  @Post('periods/:periodId/reconciliation')
  @Permissions('payroll:reconciliation:create')
  async createReconciliation(
    @Param('periodId') periodId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    const reconciliationId = await this.reconciliationService.createPeriodReconciliation(
      periodId,
      body.comparison_period_id,
      req.user.userId,
    );
    return { reconciliation_id: reconciliationId };
  }

  @Get('reconciliation/:reconciliationId')
  @Permissions('payroll:reconciliation:view')
  async getReconciliationDetails(@Param('reconciliationId') reconciliationId: string) {
    return this.reconciliationService.getReconciliationDetails(reconciliationId);
  }

  @Post('reconciliation-items/:itemId/explain')
  @Permissions('payroll:reconciliation:manage')
  async explainVariance(@Param('itemId') itemId: string, @Body() body: any) {
    await this.reconciliationService.explainVariance(itemId, body.explanation);
    return { status: 'explained' };
  }

  @Get('periods/:periodId/reconciliations')
  @Permissions('payroll:reconciliation:view')
  async getReconciliationsForPeriod(@Param('periodId') periodId: string) {
    return this.reconciliationService.getReconciliationsForPeriod(periodId);
  }

  // ==========================================
  // FORECASTING
  // ==========================================

  @Post('forecasts')
  @Permissions('payroll:forecasts:create')
  async createForecast(@Body() body: any, @Request() req: any) {
    const forecastId = await this.forecastingService.createForecast(
      body.legal_entity_id,
      body.forecast_name,
      body.forecast_type,
      body.period_start,
      body.period_end,
      body.forecast_method || 'historical_average',
      body.base_period_id || null,
      body.assumptions || {},
      req.user.userId,
    );
    return { forecast_id: forecastId };
  }

  @Get('forecasts/:forecastId')
  @Permissions('payroll:forecasts:view')
  async getForecastDetails(@Param('forecastId') forecastId: string) {
    return this.forecastingService.getForecastDetails(forecastId);
  }

  @Post('forecasts/:forecastId/update-actuals')
  @Permissions('payroll:forecasts:manage')
  async updateForecastActuals(
    @Param('forecastId') forecastId: string,
    @Body() body: any,
  ) {
    await this.forecastingService.updateForecastActuals(forecastId, body.period_id);
    return { status: 'updated' };
  }

  @Get('forecasts')
  @Permissions('payroll:forecasts:view')
  async getForecasts(@Query('legal_entity_id') legalEntityId: string) {
    return this.forecastingService.getForecasts(legalEntityId);
  }
}
