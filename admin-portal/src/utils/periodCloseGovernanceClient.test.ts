import { describe, expect, it } from 'vitest';
import {
  PERIOD_CLOSE_OVERRIDE_JUSTIFICATION_MIN,
  PAYRUN_FINANCIAL_GATE_BLOCKED,
  PAYRUN_GL_GATE_BLOCKED,
  PAYROLL_READINESS_GATE_BLOCKED,
  buildPeriodCloseOverrideHeaders,
  hasInvalidPeriodCloseOverrideSelection,
  isPeriodCloseRetryBlocked,
  periodCloseGateLabel,
} from './periodCloseGovernanceClient';

const baseSel = (over: Partial<Parameters<typeof buildPeriodCloseOverrideHeaders>[0]>) =>
  ({
    justification: '',
    useReadinessOverride: false,
    useFinancialOverride: false,
    useBankOverride: false,
    useGlOverride: false,
    canReadinessOverride: true,
    canFinancialOverride: true,
    canBankOverride: true,
    canGlOverride: true,
    ...over,
  }) as Parameters<typeof buildPeriodCloseOverrideHeaders>[0];

describe('periodCloseGovernanceClient', () => {
  it('labels known gate codes', () => {
    expect(periodCloseGateLabel(PAYROLL_READINESS_GATE_BLOCKED)).toContain('readiness');
    expect(periodCloseGateLabel(PAYRUN_FINANCIAL_GATE_BLOCKED)).toContain('GOV-3A');
    expect(periodCloseGateLabel(PAYRUN_GL_GATE_BLOCKED)).toContain('GOV-3C');
  });

  it('buildPeriodCloseOverrideHeaders sends only selected gates', () => {
    const j = 'x'.repeat(PERIOD_CLOSE_OVERRIDE_JUSTIFICATION_MIN);
    const h = buildPeriodCloseOverrideHeaders(
      baseSel({
        justification: j,
        useFinancialOverride: true,
        useBankOverride: true,
        useReadinessOverride: false,
        useGlOverride: false,
      }),
    );
    expect(h['x-financial-gate-override']).toBe('approved');
    expect(h['x-bank-gate-override']).toBe('approved');
    expect(h['x-readiness-gate-override']).toBeUndefined();
    expect(h['x-gl-gate-override']).toBeUndefined();
  });

  it('buildPeriodCloseOverrideHeaders returns empty when justification too short', () => {
    const h = buildPeriodCloseOverrideHeaders(
      baseSel({
        justification: 'short',
        useFinancialOverride: true,
      }),
    );
    expect(Object.keys(h).length).toBe(0);
  });

  it('isPeriodCloseRetryBlocked requires matching override after failure', () => {
    const j = 'y'.repeat(PERIOD_CLOSE_OVERRIDE_JUSTIFICATION_MIN);
    expect(
      isPeriodCloseRetryBlocked(PAYRUN_FINANCIAL_GATE_BLOCKED, {
        ...baseSel({ justification: j, useFinancialOverride: false }),
      }),
    ).toBe(true);
    expect(
      isPeriodCloseRetryBlocked(PAYRUN_FINANCIAL_GATE_BLOCKED, {
        ...baseSel({ justification: j, useFinancialOverride: true, canFinancialOverride: true }),
      }),
    ).toBe(false);
  });

  it('hasInvalidPeriodCloseOverrideSelection detects short justification with checkbox', () => {
    expect(
      hasInvalidPeriodCloseOverrideSelection(
        baseSel({ useGlOverride: true, justification: 'too short' }),
      ),
    ).toBe(true);
    expect(
      hasInvalidPeriodCloseOverrideSelection(
        baseSel({ useGlOverride: false, justification: '' }),
      ),
    ).toBe(false);
  });
});
