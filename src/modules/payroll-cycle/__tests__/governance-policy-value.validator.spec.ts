import { BadRequestException } from '@nestjs/common';
import { validateGovernancePolicyValue } from '../services/governance-policy-value.validator';
import {
  GOV_POLICY_KEY_BANK_FEE_TOLERANCE,
  GOV_POLICY_KEY_CLOSED_PERIOD_MUTATION_POLICY,
  GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD,
  GOV_POLICY_KEY_GL_ROUNDING_TOLERANCE,
  GOV_POLICY_KEY_OVERRIDE_JUSTIFICATION_MIN_LENGTH,
} from '../constants/governance-policy-keys';

describe('validateGovernancePolicyValue (GOV-6C)', () => {
  it('accepts numeric tolerances and wrapper objects', () => {
    expect(() => validateGovernancePolicyValue(GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD, 0)).not.toThrow();
    expect(() => validateGovernancePolicyValue(GOV_POLICY_KEY_BANK_FEE_TOLERANCE, { value: 1 })).not.toThrow();
    expect(() => validateGovernancePolicyValue(GOV_POLICY_KEY_GL_ROUNDING_TOLERANCE, 0.0001)).not.toThrow();
  });

  it('rejects negative tolerances', () => {
    expect(() => validateGovernancePolicyValue(GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD, -0.01)).toThrow(
      BadRequestException,
    );
  });

  it('accepts integer justification min length', () => {
    expect(() => validateGovernancePolicyValue(GOV_POLICY_KEY_OVERRIDE_JUSTIFICATION_MIN_LENGTH, 12)).not.toThrow();
  });

  it('rejects non-integer justification min length', () => {
    expect(() => validateGovernancePolicyValue(GOV_POLICY_KEY_OVERRIDE_JUSTIFICATION_MIN_LENGTH, 12.5)).toThrow(
      BadRequestException,
    );
  });

  it('accepts closed period mutation policy modes', () => {
    expect(() =>
      validateGovernancePolicyValue(GOV_POLICY_KEY_CLOSED_PERIOD_MUTATION_POLICY, { mode: 'GOVERNED_PATHS_ONLY' }),
    ).not.toThrow();
  });

  it('rejects invalid closed period mode', () => {
    expect(() => validateGovernancePolicyValue(GOV_POLICY_KEY_CLOSED_PERIOD_MUTATION_POLICY, { mode: 'NOPE' })).toThrow(
      BadRequestException,
    );
  });
});
