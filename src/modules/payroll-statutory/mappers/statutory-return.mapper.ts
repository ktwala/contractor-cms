import {
  StatutoryReturnDto,
  StatutoryReturnItemDto,
  StatutoryWorkflowEventDto,
  StatutoryEvidenceBundleDto,
  StatutoryReturnStatus,
} from '../statutory.types';
import { FilingDueRule } from '../statutory-profile.types';

export function computeFilingDueDate(periodEnd: Date | string, rule: FilingDueRule): Date {
  const end = new Date(periodEnd);
  const dueMonth = end.getMonth() + rule.months_after_period;
  const dueYear = end.getFullYear() + Math.floor(dueMonth / 12);
  const due = new Date(dueYear, dueMonth % 12, rule.day_of_month);
  return due;
}

export function computeDaysUntilDue(dueDate: Date | string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function mapReturnToDto(ret: any, filingDueRule?: FilingDueRule): StatutoryReturnDto {
  let filingDueDate: string | undefined;
  let filingAuthority: string | undefined;
  let daysUntilDue: number | undefined;
  let isOverdue = false;

  if (ret.filingDueDate) {
    filingDueDate = new Date(ret.filingDueDate).toISOString();
    filingAuthority = ret.filingAuthority ?? undefined;
    daysUntilDue = computeDaysUntilDue(ret.filingDueDate);
    isOverdue = daysUntilDue < 0 && !['acknowledged', 'cancelled'].includes(ret.status);
  } else if (filingDueRule && ret.periodEnd) {
    const due = computeFilingDueDate(ret.periodEnd, filingDueRule);
    filingDueDate = due.toISOString();
    filingAuthority = filingDueRule.authority;
    daysUntilDue = computeDaysUntilDue(due);
    isOverdue = daysUntilDue < 0 && !['acknowledged', 'cancelled'].includes(ret.status);
  }

  return {
    id: ret.id,
    country_code: ret.countryCode,
    legal_entity_id: ret.legalEntityId,
    pay_group_id: ret.payGroupId ?? undefined,
    return_code: ret.returnCode,
    return_label: ret.returnLabel,
    period_key: ret.periodKey,
    period_start: ret.periodStart?.toISOString?.() ?? ret.periodStart,
    period_end: ret.periodEnd?.toISOString?.() ?? ret.periodEnd,
    currency: ret.currency,
    status: ret.status as StatutoryReturnStatus,
    total_due: Number(ret.totalDue),
    employee_count: ret.employeeCount,
    source_payrun_ids: ret.sourcePayrunIds as string[],
    display_schema_key: ret.displaySchemaKey ?? undefined,
    statutory_profile_key: ret.statutoryProfileKey,
    country_pack_version: ret.countryPackVersion ?? undefined,
    generated_at: ret.generatedAt?.toISOString?.() ?? ret.generatedAt ?? undefined,
    reviewed_at: ret.reviewedAt?.toISOString?.() ?? undefined,
    approved_at: ret.approvedAt?.toISOString?.() ?? undefined,
    submitted_at: ret.submittedAt?.toISOString?.() ?? undefined,
    acknowledged_at: ret.acknowledgedAt?.toISOString?.() ?? undefined,
    evidence_bundle_id: ret.evidenceBundleId ?? undefined,
    filing_due_date: filingDueDate,
    filing_authority: filingAuthority,
    days_until_due: daysUntilDue,
    is_overdue: isOverdue,
    amends_return_id: ret.amendsReturnId ?? undefined,
    amended_by_return_id: ret.amendedBy?.[0]?.id ?? undefined,
    version_number: ret.versionNumber ?? 1,
    items: (ret.items ?? []).map(mapItemToDto),
    workflow_events: (ret.workflowEvents ?? []).map(mapWorkflowEventToDto),
    metadata: ret.metadata as Record<string, unknown> | undefined,
  };
}

export function mapItemToDto(item: any): StatutoryReturnItemDto {
  return {
    id: item.id,
    item_code: item.itemCode,
    item_label: item.itemLabel,
    amount: Number(item.amount),
    currency: item.currency,
    source_line_codes: item.sourceLineCodes as string[],
    employee_count: item.employeeCount ?? undefined,
    sort_order: item.sortOrder,
    metadata: item.metadata as Record<string, unknown> | undefined,
  };
}

export function mapWorkflowEventToDto(evt: any): StatutoryWorkflowEventDto {
  return {
    id: evt.id,
    event_type: evt.eventType,
    from_status: evt.fromStatus as StatutoryReturnStatus | null,
    to_status: evt.toStatus as StatutoryReturnStatus,
    performed_by_user_id: evt.performedByUserId ?? undefined,
    performed_at: evt.performedAt?.toISOString?.() ?? evt.performedAt,
    comment: evt.comment ?? undefined,
    metadata: evt.metadata as Record<string, unknown> | undefined,
  };
}

export function mapEvidenceBundleToDto(bundle: any): StatutoryEvidenceBundleDto {
  return {
    id: bundle.id,
    statutory_return_id: bundle.statutoryReturnId,
    country_code: bundle.countryCode,
    return_code: bundle.returnCode,
    period_key: bundle.periodKey,
    legal_entity_id: bundle.legalEntityId,
    artifacts: bundle.artifacts as any[],
    created_at: bundle.createdAt?.toISOString?.() ?? bundle.createdAt,
    created_by_user_id: bundle.createdByUserId ?? undefined,
    metadata: bundle.metadata as Record<string, unknown> | undefined,
  };
}
