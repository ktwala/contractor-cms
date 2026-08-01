import axios from 'axios';

/** Matches backend `PayrunReadinessGateService` / `ForbiddenException` payload `code`. */
export const PAYROLL_READINESS_GATE_BLOCKED = 'PAYROLL_READINESS_GATE_BLOCKED' as const;

/** Matches backend `PAYRUN_READINESS_OVERRIDE_JUSTIFICATION_MIN`. */
export const READINESS_OVERRIDE_JUSTIFICATION_MIN_LENGTH = 20;

export function readinessOverrideRequestHeaders(justification: string): Record<string, string> {
  return {
    'x-readiness-gate-override': 'approved',
    'x-readiness-override-justification': justification.trim(),
  };
}

export function isPayrollReadinessGateBlockedError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  const code = err.response?.data?.code;
  return err.response?.status === 403 && code === PAYROLL_READINESS_GATE_BLOCKED;
}

/**
 * UI may allow proceeding only when readiness is green, or when the user has documented override inputs.
 */
export function canProceedPayrunExecutionWithReadiness(opts: {
  canCreatePayrun: boolean;
  hasOverridePermission: boolean;
  useReadinessOverride: boolean;
  overrideJustification: string;
}): boolean {
  if (opts.canCreatePayrun) return true;
  const j = opts.overrideJustification.trim();
  return (
    opts.hasOverridePermission &&
    opts.useReadinessOverride &&
    j.length >= READINESS_OVERRIDE_JUSTIFICATION_MIN_LENGTH
  );
}
