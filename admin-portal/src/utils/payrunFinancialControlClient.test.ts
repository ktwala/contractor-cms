import axios from 'axios';
import { describe, expect, it } from 'vitest';
import {
  FINANCIAL_OVERRIDE_JUSTIFICATION_MIN_LENGTH,
  canProceedMarkPaidOrPostedWithFinancialControl,
  isPayrunFinancialGateBlockedError,
  financialOverrideRequestHeaders,
} from './payrunFinancialControlClient';

describe('payrunFinancialControlClient', () => {
  it('builds financial override headers', () => {
    expect(financialOverrideRequestHeaders('y'.repeat(20))).toMatchObject({
      'x-financial-gate-override': 'approved',
    });
  });

  it('detects financial gate blocked axios errors', () => {
    const err = new axios.AxiosError('Forbidden');
    err.response = {
      status: 403,
      statusText: 'Forbidden',
      headers: {},
      config: {} as any,
      data: { code: 'PAYRUN_FINANCIAL_GATE_BLOCKED' },
    };
    expect(isPayrunFinancialGateBlockedError(err)).toBe(true);
  });

  it('canProceedMarkPaidOrPostedWithFinancialControl', () => {
    expect(
      canProceedMarkPaidOrPostedWithFinancialControl({
        control: { status: 'MATCH' },
        hasFinancialOverridePermission: false,
        useFinancialOverride: false,
        overrideJustification: '',
      }),
    ).toBe(true);
    expect(
      canProceedMarkPaidOrPostedWithFinancialControl({
        control: { status: 'BLOCKED' },
        hasFinancialOverridePermission: true,
        useFinancialOverride: true,
        overrideJustification: 'z'.repeat(FINANCIAL_OVERRIDE_JUSTIFICATION_MIN_LENGTH),
      }),
    ).toBe(true);
    expect(
      canProceedMarkPaidOrPostedWithFinancialControl({
        control: null,
        hasFinancialOverridePermission: true,
        useFinancialOverride: true,
        overrideJustification: 'z'.repeat(FINANCIAL_OVERRIDE_JUSTIFICATION_MIN_LENGTH),
      }),
    ).toBe(false);
  });
});
