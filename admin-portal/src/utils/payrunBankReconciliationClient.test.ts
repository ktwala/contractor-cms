import axios from 'axios';
import { describe, expect, it } from 'vitest';
import {
  BANK_OVERRIDE_JUSTIFICATION_MIN_LENGTH,
  canProceedMarkPostedWithBankControl,
  isPayrunBankGateBlockedError,
  bankOverrideRequestHeaders,
} from './payrunBankReconciliationClient';

describe('payrunBankReconciliationClient', () => {
  it('builds bank override headers', () => {
    expect(bankOverrideRequestHeaders('y'.repeat(20))).toMatchObject({
      'x-bank-gate-override': 'approved',
    });
  });

  it('detects bank gate blocked axios errors', () => {
    const err = new axios.AxiosError('Forbidden');
    err.response = {
      status: 403,
      statusText: 'Forbidden',
      headers: {},
      config: {} as any,
      data: { code: 'PAYRUN_BANK_GATE_BLOCKED' },
    };
    expect(isPayrunBankGateBlockedError(err)).toBe(true);
  });

  it('canProceedMarkPostedWithBankControl', () => {
    expect(
      canProceedMarkPostedWithBankControl({
        control: { status: 'MATCH' },
        hasBankOverridePermission: false,
        useBankOverride: false,
        overrideJustification: '',
      }),
    ).toBe(true);
    expect(
      canProceedMarkPostedWithBankControl({
        control: { status: 'VARIANCE', review_required: false },
        hasBankOverridePermission: false,
        useBankOverride: false,
        overrideJustification: '',
      }),
    ).toBe(true);
    expect(
      canProceedMarkPostedWithBankControl({
        control: null,
        hasBankOverridePermission: true,
        useBankOverride: true,
        overrideJustification: 'z'.repeat(BANK_OVERRIDE_JUSTIFICATION_MIN_LENGTH),
      }),
    ).toBe(false);
  });
});
