import axios from 'axios';

/** Backend code when cancel is blocked by an existing / exported payment batch. */
export const PAYRUN_CANCEL_BLOCKED_PAYMENT_BATCH = 'PAYRUN_CANCEL_BLOCKED_PAYMENT_BATCH';

export function isPayrunCancelBlockedError(e: unknown): boolean {
  const code = (e as { response?: { data?: { code?: string } } })?.response?.data?.code;
  return code === PAYRUN_CANCEL_BLOCKED_PAYMENT_BATCH;
}

export function isCancelledTerminalStatus(status: string | undefined | null): boolean {
  return String(status ?? '').toUpperCase() === 'CANCELLED';
}

/** Statuses where governed cancel is product-valid (must match server). */
export const PAYRUN_CANCELABLE_STATUSES = ['DRAFT', 'SNAPSHOT', 'CALCULATED', 'IN_REVIEW'] as const;

export function canShowCancelPayrunButton(params: {
  status: string | undefined | null;
  hasPermission: boolean;
  periodClosedImmutable: boolean;
}): boolean {
  const st = String(params.status ?? '');
  return (
    (PAYRUN_CANCELABLE_STATUSES as readonly string[]).includes(st) &&
    params.hasPermission &&
    !params.periodClosedImmutable
  );
}

export function payrunCancelBlockedAxiosExample(): axios.AxiosError {
  const err = new axios.AxiosError('Conflict');
  err.response = {
    status: 409,
    statusText: 'Conflict',
    headers: {},
    config: {} as any,
    data: {
      code: PAYRUN_CANCEL_BLOCKED_PAYMENT_BATCH,
      message: 'Cannot cancel: payment batch',
      details: { batch_id: 'b1' },
    },
  };
  return err;
}
