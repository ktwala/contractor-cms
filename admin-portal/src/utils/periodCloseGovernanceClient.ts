import {
  PAYROLL_READINESS_GATE_BLOCKED,
  readinessOverrideRequestHeaders,
} from './payrunExecutionClient';
import {
  PAYRUN_FINANCIAL_GATE_BLOCKED,
  financialOverrideRequestHeaders,
} from './payrunFinancialControlClient';
import {
  PAYRUN_BANK_GATE_BLOCKED,
  bankOverrideRequestHeaders,
} from './payrunBankReconciliationClient';
import { PAYRUN_GL_GATE_BLOCKED, glOverrideRequestHeaders } from './payrunGlReconciliationClient';

/** Align with backend override justification minimums (readiness / financial / bank / GL). */
export const PERIOD_CLOSE_OVERRIDE_JUSTIFICATION_MIN = 20;

export {
  PAYROLL_READINESS_GATE_BLOCKED,
  PAYRUN_FINANCIAL_GATE_BLOCKED,
  PAYRUN_BANK_GATE_BLOCKED,
  PAYRUN_GL_GATE_BLOCKED,
};

export type PeriodCloseBlockedCode =
  | typeof PAYROLL_READINESS_GATE_BLOCKED
  | typeof PAYRUN_FINANCIAL_GATE_BLOCKED
  | typeof PAYRUN_BANK_GATE_BLOCKED
  | typeof PAYRUN_GL_GATE_BLOCKED;

export function periodCloseGateLabel(code: string | undefined | null): string {
  switch (code) {
    case PAYROLL_READINESS_GATE_BLOCKED:
      return 'Payroll readiness (GOV-1/2)';
    case PAYRUN_FINANCIAL_GATE_BLOCKED:
      return 'Financial control — register vs export (GOV-3A)';
    case PAYRUN_BANK_GATE_BLOCKED:
      return 'Bank confirmation — export vs settlement (GOV-3B)';
    case PAYRUN_GL_GATE_BLOCKED:
      return 'GL reconciliation — register vs posting (GOV-3C)';
    default:
      return code ? `Governance gate (${code})` : 'Unknown gate';
  }
}

export type PeriodCloseOverrideSelection = {
  justification: string;
  useReadinessOverride: boolean;
  useFinancialOverride: boolean;
  useBankOverride: boolean;
  useGlOverride: boolean;
  canReadinessOverride: boolean;
  canFinancialOverride: boolean;
  canBankOverride: boolean;
  canGlOverride: boolean;
};

/**
 * Sends only override header pairs for checked gates the user is permitted to use.
 * Justification must meet minimum length (trimmed) or no override headers are added.
 */
export function buildPeriodCloseOverrideHeaders(sel: PeriodCloseOverrideSelection): Record<string, string> {
  const j = sel.justification.trim();
  if (j.length < PERIOD_CLOSE_OVERRIDE_JUSTIFICATION_MIN) {
    return {};
  }
  const out: Record<string, string> = {};
  if (sel.useReadinessOverride && sel.canReadinessOverride) {
    Object.assign(out, readinessOverrideRequestHeaders(j));
  }
  if (sel.useFinancialOverride && sel.canFinancialOverride) {
    Object.assign(out, financialOverrideRequestHeaders(j));
  }
  if (sel.useBankOverride && sel.canBankOverride) {
    Object.assign(out, bankOverrideRequestHeaders(j));
  }
  if (sel.useGlOverride && sel.canGlOverride) {
    Object.assign(out, glOverrideRequestHeaders(j));
  }
  return out;
}

/**
 * After a failed period close, disable retry until the user enables the override path
 * that matches the gate returned by the API (first failing gate in the backend chain).
 */
/** True when any override checkbox is on but justification or permission is invalid. */
export function hasInvalidPeriodCloseOverrideSelection(sel: PeriodCloseOverrideSelection): boolean {
  const anyChecked =
    sel.useReadinessOverride || sel.useFinancialOverride || sel.useBankOverride || sel.useGlOverride;
  if (!anyChecked) {
    return false;
  }
  const j = sel.justification.trim();
  if (j.length < PERIOD_CLOSE_OVERRIDE_JUSTIFICATION_MIN) {
    return true;
  }
  if (sel.useReadinessOverride && !sel.canReadinessOverride) {
    return true;
  }
  if (sel.useFinancialOverride && !sel.canFinancialOverride) {
    return true;
  }
  if (sel.useBankOverride && !sel.canBankOverride) {
    return true;
  }
  if (sel.useGlOverride && !sel.canGlOverride) {
    return true;
  }
  return false;
}

export function isPeriodCloseRetryBlocked(
  blockedCode: string | null | undefined,
  sel: PeriodCloseOverrideSelection,
): boolean {
  if (!blockedCode) {
    return false;
  }
  const j = sel.justification.trim();
  const okLen = j.length >= PERIOD_CLOSE_OVERRIDE_JUSTIFICATION_MIN;
  switch (blockedCode) {
    case PAYROLL_READINESS_GATE_BLOCKED:
      return !(sel.useReadinessOverride && sel.canReadinessOverride && okLen);
    case PAYRUN_FINANCIAL_GATE_BLOCKED:
      return !(sel.useFinancialOverride && sel.canFinancialOverride && okLen);
    case PAYRUN_BANK_GATE_BLOCKED:
      return !(sel.useBankOverride && sel.canBankOverride && okLen);
    case PAYRUN_GL_GATE_BLOCKED:
      return !(sel.useGlOverride && sel.canGlOverride && okLen);
    default:
      return false;
  }
}
