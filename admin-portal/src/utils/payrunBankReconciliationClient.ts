import axios from 'axios';

export const PAYRUN_BANK_GATE_BLOCKED = 'PAYRUN_BANK_GATE_BLOCKED' as const;

/** Align with backend `PAYRUN_BANK_OVERRIDE_JUSTIFICATION_MIN`. */
export const BANK_OVERRIDE_JUSTIFICATION_MIN_LENGTH = 20;

export function bankOverrideRequestHeaders(justification: string): Record<string, string> {
  return {
    'x-bank-gate-override': 'approved',
    'x-bank-override-justification': justification.trim(),
  };
}

export function isPayrunBankGateBlockedError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  return err.response?.status === 403 && err.response?.data?.code === PAYRUN_BANK_GATE_BLOCKED;
}

export function canProceedMarkPostedWithBankControl(opts: {
  control: { status: string; reviewed_at?: string | null; review_required?: boolean } | null | undefined;
  hasBankOverridePermission: boolean;
  useBankOverride: boolean;
  overrideJustification: string;
}): boolean {
  const { control } = opts;
  if (control === undefined) return false;
  if (control === null) return false;
  if (control.status === 'MATCH') return true;
  if (control.status === 'VARIANCE') {
    if (control.reviewed_at) return true;
    if (control.review_required === false) return true;
  }
  if (
    (control.status === 'REJECTED' || control.status === 'PARTIAL') &&
    control.reviewed_at
  ) {
    return true;
  }
  const j = opts.overrideJustification.trim();
  return (
    opts.hasBankOverridePermission &&
    opts.useBankOverride &&
    j.length >= BANK_OVERRIDE_JUSTIFICATION_MIN_LENGTH
  );
}
