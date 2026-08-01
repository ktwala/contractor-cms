import axios from 'axios';

export const PAYRUN_GL_GATE_BLOCKED = 'PAYRUN_GL_GATE_BLOCKED' as const;

/** Align with backend `PAYRUN_GL_OVERRIDE_JUSTIFICATION_MIN`. */
export const GL_OVERRIDE_JUSTIFICATION_MIN_LENGTH = 20;

export function glOverrideRequestHeaders(justification: string): Record<string, string> {
  return {
    'x-gl-gate-override': 'approved',
    'x-gl-override-justification': justification.trim(),
  };
}

export function isPayrunGlGateBlockedError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  return err.response?.status === 403 && err.response?.data?.code === PAYRUN_GL_GATE_BLOCKED;
}

export function canProceedPeriodCloseWithGlControl(opts: {
  control: { status: string; reviewed_at?: string | null; review_required?: boolean } | null | undefined;
  hasGlOverridePermission: boolean;
  useGlOverride: boolean;
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
  const j = opts.overrideJustification.trim();
  return (
    opts.hasGlOverridePermission &&
    opts.useGlOverride &&
    j.length >= GL_OVERRIDE_JUSTIFICATION_MIN_LENGTH
  );
}
