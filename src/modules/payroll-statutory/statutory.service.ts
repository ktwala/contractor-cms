import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { PayrollResultsService } from '../payroll-results/payroll-results.service';
import { StatutoryProfileRegistry } from './statutory-profile.registry';
import { StatutoryValidationService } from './statutory-validation.service';
import { StatutoryReturnBuilderService, PayrunContext } from './statutory-return-builder.service';
import { StatutoryEvidenceService } from './statutory-evidence.service';
import { StatutoryRepository, ListReturnsFilters } from './repository/statutory.repository';
import {
  mapReturnToDto,
  mapEvidenceBundleToDto,
  computeFilingDueDate,
  computeDaysUntilDue,
} from './mappers/statutory-return.mapper';
import {
  StatutoryReturnDto,
  StatutoryEvidenceBundleDto,
  ComplianceDashboardDto,
  FilingCalendarEntry,
  ExposureSummary,
  WorkflowAlert,
  StatutoryReturnStatus,
} from './statutory.types';

@Injectable()
export class StatutoryService {
  private readonly logger = new Logger(StatutoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly resultsService: PayrollResultsService,
    private readonly profileRegistry: StatutoryProfileRegistry,
    private readonly validation: StatutoryValidationService,
    private readonly builder: StatutoryReturnBuilderService,
    private readonly evidence: StatutoryEvidenceService,
    private readonly repository: StatutoryRepository,
  ) {}

  async generateFromPayrun(
    payrunId: string,
    returnCode?: string,
    userId?: string,
  ): Promise<StatutoryReturnDto[]> {
    const payrun = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      include: { payGroup: true, context: true },
    });

    if (!payrun) {
      throw new NotFoundException(`PayRun ${payrunId} not found`);
    }

    const countryCode = payrun.payGroup.country;
    const currency = payrun.payGroup.currency;
    const profile = this.profileRegistry.get(countryCode);

    const resultsResponse = await this.resultsService.getPayrunResults(payrunId, 0, 10000);
    const results = resultsResponse.employee_results;

    const definitions = returnCode
      ? profile.supported_returns.filter((d) => d.return_code === returnCode)
      : profile.supported_returns;

    for (const def of definitions) {
      this.validation.validateAll(
        payrunId,
        payrun.status,
        results,
        profile,
        def,
        countryCode,
        currency,
      );
    }

    const packVersion = (payrun.context as any)?.packVersion;
    const periodKey = this.derivePeriodKey(payrun.periodStart);
    const ctx: PayrunContext = {
      id: payrunId,
      countryCode,
      legalEntityId: payrun.payGroup.legalEntityId ?? '',
      payGroupId: payrun.payGroupId,
      periodKey,
      periodStart: payrun.periodStart ?? new Date(),
      periodEnd: payrun.periodEnd ?? new Date(),
      currency,
      countryPackVersion: packVersion
        ? `${countryCode}.${packVersion}`
        : `${countryCode}.v1`,
      status: payrun.status,
    };

    const drafts = this.builder.buildDraftReturnsFromPayrun(
      ctx,
      results,
      profile,
      returnCode,
      userId,
    );

    const persisted: StatutoryReturnDto[] = [];

    for (const draft of drafts) {
      const def = profile.supported_returns.find(
        (d) => d.return_code === draft.return_code,
      );

      let filingDueDate: Date | undefined;
      let filingAuthority: string | undefined;
      if (def?.filing_due_rule) {
        filingDueDate = computeFilingDueDate(
          new Date(draft.period_end),
          def.filing_due_rule,
        );
        filingAuthority = def.filing_due_rule.authority;
      }

      const currentVersion = await this.repository.getLatestVersionNumber(
        countryCode,
        draft.return_code,
        periodKey,
      );

      const saved = await this.repository.createReturnWithItems({
        countryCode: draft.country_code,
        legalEntityId: draft.legal_entity_id,
        payGroupId: draft.pay_group_id,
        returnCode: draft.return_code,
        returnLabel: draft.return_label,
        periodKey: draft.period_key,
        periodStart: new Date(draft.period_start),
        periodEnd: new Date(draft.period_end),
        currency: draft.currency,
        status: draft.status,
        totalDue: draft.total_due,
        employeeCount: draft.employee_count,
        sourcePayrunIds: draft.source_payrun_ids,
        displaySchemaKey: draft.display_schema_key,
        statutoryProfileKey: draft.statutory_profile_key,
        countryPackVersion: draft.country_pack_version,
        generatedAt: new Date(draft.generated_at!),
        generatedByUserId: userId,
        versionNumber: currentVersion + 1,
        filingDueDate,
        filingAuthority,
        metadata: draft.metadata,
        items: draft.items.map((i) => ({
          itemCode: i.item_code,
          itemLabel: i.item_label,
          amount: i.amount,
          currency: i.currency,
          sourceLineCodes: i.source_line_codes,
          employeeCount: i.employee_count,
          sortOrder: i.sort_order,
          metadata: i.metadata,
        })),
      });

      if (def?.requires_evidence_bundle) {
        await this.evidence.generateBundle(draft, saved.id, results, userId);
      }

      const full = await this.repository.getReturnById(saved.id);
      persisted.push(mapReturnToDto(full, def?.filing_due_rule));

      this.logger.log(
        `Generated ${draft.return_code} v${currentVersion + 1} for ${draft.period_key}: total_due=${draft.total_due} ${draft.currency}`,
      );
    }

    return persisted;
  }

  async generateAmendment(
    originalReturnId: string,
    payrunId: string,
    userId?: string,
  ): Promise<StatutoryReturnDto[]> {
    const original = await this.repository.getReturnById(originalReturnId);
    if (!original) {
      throw new NotFoundException(`Return ${originalReturnId} not found`);
    }
    if (!['submitted', 'acknowledged'].includes(original.status)) {
      throw new Error(
        `Cannot amend return in status '${original.status}'. Only submitted or acknowledged returns can be amended.`,
      );
    }

    await this.repository.updateReturnStatus(
      originalReturnId,
      'amended',
      'updatedAt',
      userId,
    );
    await this.repository.createWorkflowEvent({
      statutoryReturnId: originalReturnId,
      eventType: 'AMENDED',
      fromStatus: original.status,
      toStatus: 'amended',
      performedByUserId: userId,
      comment: 'Amended — new version generated',
    });

    const newReturns = await this.generateFromPayrun(
      payrunId,
      original.returnCode,
      userId,
    );

    return newReturns;
  }

  async listReturns(filters: ListReturnsFilters): Promise<StatutoryReturnDto[]> {
    const returns = await this.repository.listReturns(filters);
    return returns.map((r) => {
      const profile = this.profileRegistry.has(r.countryCode)
        ? this.profileRegistry.get(r.countryCode)
        : undefined;
      const def = profile?.supported_returns.find(
        (d) => d.return_code === r.returnCode,
      );
      return mapReturnToDto(r, def?.filing_due_rule);
    });
  }

  async getReturn(returnId: string): Promise<StatutoryReturnDto> {
    const ret = await this.repository.getReturnById(returnId);
    if (!ret) throw new NotFoundException(`Statutory return ${returnId} not found`);
    const profile = this.profileRegistry.has(ret.countryCode)
      ? this.profileRegistry.get(ret.countryCode)
      : undefined;
    const def = profile?.supported_returns.find(
      (d) => d.return_code === ret.returnCode,
    );
    return mapReturnToDto(ret, def?.filing_due_rule);
  }

  async getReturnEvidence(returnId: string): Promise<StatutoryEvidenceBundleDto> {
    const bundle = await this.repository.getEvidenceBundle(returnId);
    if (!bundle) {
      throw new NotFoundException(`No evidence bundle found for return ${returnId}`);
    }
    return mapEvidenceBundleToDto(bundle);
  }

  async getComplianceDashboard(): Promise<ComplianceDashboardDto> {
    const allReturns = await this.repository.getAllReturnsForDashboard();

    const filingCalendar: FilingCalendarEntry[] = [];
    const allItems: Array<{ item_code: string; item_label: string; amount: number; currency: string; country_code: string }> = [];

    for (const ret of allReturns) {
      const profile = this.profileRegistry.has(ret.countryCode)
        ? this.profileRegistry.get(ret.countryCode)
        : undefined;
      const def = profile?.supported_returns.find(
        (d) => d.return_code === ret.returnCode,
      );

      let dueDateStr: string;
      let authority: string;
      let daysUntilDue: number;

      if (ret.filingDueDate) {
        dueDateStr = new Date(ret.filingDueDate).toISOString();
        authority = ret.filingAuthority ?? def?.filing_due_rule?.authority ?? '';
        daysUntilDue = computeDaysUntilDue(ret.filingDueDate);
      } else if (def?.filing_due_rule) {
        const due = computeFilingDueDate(ret.periodEnd, def.filing_due_rule);
        dueDateStr = due.toISOString();
        authority = def.filing_due_rule.authority;
        daysUntilDue = computeDaysUntilDue(due);
      } else {
        dueDateStr = '';
        authority = '';
        daysUntilDue = 999;
      }

      const isOverdue = daysUntilDue < 0 && !['acknowledged', 'cancelled', 'amended'].includes(ret.status);

      filingCalendar.push({
        return_id: ret.id,
        country_code: ret.countryCode,
        return_code: ret.returnCode,
        return_label: ret.returnLabel,
        period_key: ret.periodKey,
        status: ret.status as StatutoryReturnStatus,
        total_due: Number(ret.totalDue),
        currency: ret.currency,
        filing_due_date: dueDateStr,
        filing_authority: authority,
        days_until_due: daysUntilDue,
        is_overdue: isOverdue,
      });

      for (const item of ret.items) {
        allItems.push({
          item_code: item.itemCode,
          item_label: item.itemLabel,
          amount: Number(item.amount),
          currency: ret.currency,
          country_code: ret.countryCode,
        });
      }
    }

    const exposure = this.buildExposureSummary(allReturns, allItems);
    const alerts = this.buildWorkflowAlerts(filingCalendar);

    filingCalendar.sort((a, b) => a.days_until_due - b.days_until_due);

    return {
      filing_calendar: filingCalendar,
      exposure,
      workflow_alerts: alerts,
    };
  }

  private buildExposureSummary(
    returns: any[],
    items: Array<{ item_code: string; item_label: string; amount: number; currency: string; country_code: string }>,
  ): ExposureSummary {
    const activeReturns = returns.filter((r) =>
      !['cancelled', 'amended'].includes(r.status),
    );
    const totalLiability = activeReturns.reduce(
      (sum, r) => sum + Number(r.totalDue),
      0,
    );
    const primaryCurrency = activeReturns[0]?.currency ?? 'ZAR';

    const byItemMap = new Map<string, { label: string; total: number }>();
    for (const item of items) {
      const existing = byItemMap.get(item.item_code);
      if (existing) {
        existing.total += item.amount;
      } else {
        byItemMap.set(item.item_code, { label: item.item_label, total: item.amount });
      }
    }

    const byCountryMap = new Map<string, { total: number; currency: string }>();
    for (const r of activeReturns) {
      const existing = byCountryMap.get(r.countryCode);
      if (existing) {
        existing.total += Number(r.totalDue);
      } else {
        byCountryMap.set(r.countryCode, { total: Number(r.totalDue), currency: r.currency });
      }
    }

    return {
      total_statutory_liability: Math.round(totalLiability * 100) / 100,
      currency: primaryCurrency,
      by_item: Array.from(byItemMap.entries()).map(([code, v]) => ({
        item_code: code,
        item_label: v.label,
        total: Math.round(v.total * 100) / 100,
      })),
      by_country: Array.from(byCountryMap.entries()).map(([code, v]) => ({
        country_code: code,
        total: Math.round(v.total * 100) / 100,
        currency: v.currency,
      })),
    };
  }

  private buildWorkflowAlerts(calendar: FilingCalendarEntry[]): WorkflowAlert[] {
    const alerts: WorkflowAlert[] = [];

    for (const entry of calendar) {
      if (entry.status === 'draft') {
        alerts.push({
          type: 'awaiting_review',
          severity: entry.is_overdue ? 'critical' : 'info',
          message: `${entry.return_code} ${entry.period_key} is still a draft`,
          return_id: entry.return_id!,
          return_code: entry.return_code,
          country_code: entry.country_code,
          period_key: entry.period_key,
          days_until_due: entry.days_until_due,
        });
      }

      if (entry.status === 'under_review') {
        alerts.push({
          type: 'awaiting_approval',
          severity: entry.days_until_due <= 3 ? 'warning' : 'info',
          message: `${entry.return_code} ${entry.period_key} awaiting approval`,
          return_id: entry.return_id!,
          return_code: entry.return_code,
          country_code: entry.country_code,
          period_key: entry.period_key,
          days_until_due: entry.days_until_due,
        });
      }

      if (entry.status === 'submitted') {
        alerts.push({
          type: 'awaiting_acknowledgement',
          severity: 'info',
          message: `${entry.return_code} ${entry.period_key} submitted, awaiting acknowledgement`,
          return_id: entry.return_id!,
          return_code: entry.return_code,
          country_code: entry.country_code,
          period_key: entry.period_key,
          days_until_due: entry.days_until_due,
        });
      }

      if (entry.is_overdue) {
        alerts.push({
          type: 'overdue',
          severity: 'critical',
          message: `${entry.return_code} ${entry.period_key} is ${Math.abs(entry.days_until_due)} day(s) overdue`,
          return_id: entry.return_id!,
          return_code: entry.return_code,
          country_code: entry.country_code,
          period_key: entry.period_key,
          days_until_due: entry.days_until_due,
        });
      } else if (entry.days_until_due <= 5 && !['acknowledged', 'submitted'].includes(entry.status as string)) {
        alerts.push({
          type: 'approaching_due',
          severity: 'warning',
          message: `${entry.return_code} ${entry.period_key} due in ${entry.days_until_due} day(s)`,
          return_id: entry.return_id!,
          return_code: entry.return_code,
          country_code: entry.country_code,
          period_key: entry.period_key,
          days_until_due: entry.days_until_due,
        });
      }
    }

    alerts.sort((a, b) => {
      const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
      return (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3);
    });

    return alerts;
  }

  private derivePeriodKey(date: Date | null | undefined): string {
    if (!date) return 'UNKNOWN';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
}
