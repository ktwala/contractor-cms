import axios from 'axios';

export const PAYRUN_FINANCIAL_GATE_BLOCKED = 'PAYRUN_FINANCIAL_GATE_BLOCKED' as const;

/** Align with backend `PAYRUN_FINANCIAL_OVERRIDE_JUSTIFICATION_MIN`. */
export const FINANCIAL_OVERRIDE_JUSTIFICATION_MIN_LENGTH = 20;

export function financialOverrideRequestHeaders(justification: string): Record<string, string> {
  return {
    'x-financial-gate-override': 'approved',
    'x-financial-override-justification': justification.trim(),
  };
}

export function isPayrunFinancialGateBlockedError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  return err.response?.status === 403 && err.response?.data?.code === PAYRUN_FINANCIAL_GATE_BLOCKED;
}

export function canProceedMarkPaidOrPostedWithFinancialControl(opts: {
  control: { status: string; reviewed_at?: string | null } | null | undefined;
  hasFinancialOverridePermission: boolean;
  useFinancialOverride: boolean;
  overrideJustification: string;
}): boolean {
  const { control } = opts;
  if (control === undefined) return false;
  if (control === null) return false;
  if (control.status === 'MATCH') return true;
  if (control.status === 'VARIANCE' && control.reviewed_at) return true;
  const j = opts.overrideJustification.trim();
  return (
    opts.hasFinancialOverridePermission &&
    opts.useFinancialOverride &&
    j.length >= FINANCIAL_OVERRIDE_JUSTIFICATION_MIN_LENGTH
  );
}
