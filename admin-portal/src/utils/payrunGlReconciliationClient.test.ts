import axios from 'axios';
import { describe, expect, it } from 'vitest';
import {
  GL_OVERRIDE_JUSTIFICATION_MIN_LENGTH,
  canProceedPeriodCloseWithGlControl,
  isPayrunGlGateBlockedError,
  glOverrideRequestHeaders,
} from './payrunGlReconciliationClient';

describe('payrunGlReconciliationClient', () => {
  it('builds GL override headers', () => {
    expect(glOverrideRequestHeaders('y'.repeat(20))).toMatchObject({
      'x-gl-gate-override': 'approved',
    });
  });

  it('detects GL gate blocked axios errors', () => {
    const err = new axios.AxiosError('Forbidden');
    err.response = {
      status: 403,
      statusText: 'Forbidden',
      headers: {},
      config: {} as any,
      data: { code: 'PAYRUN_GL_GATE_BLOCKED' },
    };
    expect(isPayrunGlGateBlockedError(err)).toBe(true);
  });

  it('canProceedPeriodCloseWithGlControl', () => {
    expect(
      canProceedPeriodCloseWithGlControl({
        control: { status: 'MATCH' },
        hasGlOverridePermission: false,
        useGlOverride: false,
        overrideJustification: '',
      }),
    ).toBe(true);
    expect(
      canProceedPeriodCloseWithGlControl({
        control: null,
        hasGlOverridePermission: true,
        useGlOverride: true,
        overrideJustification: 'z'.repeat(GL_OVERRIDE_JUSTIFICATION_MIN_LENGTH),
      }),
    ).toBe(false);
  });
});
