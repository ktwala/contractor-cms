import { describe, expect, it } from 'vitest';
import {
  PAYRUN_CANCEL_BLOCKED_PAYMENT_BATCH,
  canShowCancelPayrunButton,
  isCancelledTerminalStatus,
  isPayrunCancelBlockedError,
  payrunCancelBlockedAxiosExample,
} from './payrunCancelClient';

describe('payrunCancelClient', () => {
  it('detects cancel-blocked axios errors', () => {
    expect(isPayrunCancelBlockedError(payrunCancelBlockedAxiosExample())).toBe(true);
    expect(isPayrunCancelBlockedError(new Error('x'))).toBe(false);
  });

  it('recognises terminal cancelled', () => {
    expect(isCancelledTerminalStatus('CANCELLED')).toBe(true);
    expect(isCancelledTerminalStatus('DRAFT')).toBe(false);
  });

  it('canShowCancelPayrunButton matches product gates', () => {
    expect(
      canShowCancelPayrunButton({
        status: 'DRAFT',
        hasPermission: true,
        periodClosedImmutable: false,
      }),
    ).toBe(true);
    expect(
      canShowCancelPayrunButton({
        status: 'APPROVED',
        hasPermission: true,
        periodClosedImmutable: false,
      }),
    ).toBe(false);
    expect(
      canShowCancelPayrunButton({
        status: 'DRAFT',
        hasPermission: false,
        periodClosedImmutable: false,
      }),
    ).toBe(false);
    expect(PAYRUN_CANCEL_BLOCKED_PAYMENT_BATCH).toBe('PAYRUN_CANCEL_BLOCKED_PAYMENT_BATCH');
  });
});
