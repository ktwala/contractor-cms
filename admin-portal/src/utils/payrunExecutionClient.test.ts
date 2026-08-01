import axios from 'axios';
import { describe, expect, it } from 'vitest';
import {
  READINESS_OVERRIDE_JUSTIFICATION_MIN_LENGTH,
  canProceedPayrunExecutionWithReadiness,
  isPayrollReadinessGateBlockedError,
  readinessOverrideRequestHeaders,
} from './payrunExecutionClient';

describe('payrunExecutionClient', () => {
  it('builds override headers', () => {
    expect(readinessOverrideRequestHeaders('  x '.repeat(10))).toMatchObject({
      'x-readiness-gate-override': 'approved',
      'x-readiness-override-justification': expect.stringContaining('x'),
    });
  });

  it('detects readiness gate blocked axios errors', () => {
    const err = new axios.AxiosError('Forbidden');
    err.response = {
      status: 403,
      statusText: 'Forbidden',
      headers: {},
      config: {} as any,
      data: { code: 'PAYROLL_READINESS_GATE_BLOCKED', message: 'blocked' },
    };
    expect(isPayrollReadinessGateBlockedError(err)).toBe(true);
    expect(isPayrollReadinessGateBlockedError(new Error('other'))).toBe(false);
  });

  it('canProceedPayrunExecutionWithReadiness matches minimum justification length', () => {
    expect(
      canProceedPayrunExecutionWithReadiness({
        canCreatePayrun: false,
        hasOverridePermission: true,
        useReadinessOverride: true,
        overrideJustification: 'a'.repeat(READINESS_OVERRIDE_JUSTIFICATION_MIN_LENGTH),
      }),
    ).toBe(true);
    expect(
      canProceedPayrunExecutionWithReadiness({
        canCreatePayrun: false,
        hasOverridePermission: true,
        useReadinessOverride: true,
        overrideJustification: 'short',
      }),
    ).toBe(false);
    expect(
      canProceedPayrunExecutionWithReadiness({
        canCreatePayrun: true,
        hasOverridePermission: false,
        useReadinessOverride: false,
        overrideJustification: '',
      }),
    ).toBe(true);
  });
});
