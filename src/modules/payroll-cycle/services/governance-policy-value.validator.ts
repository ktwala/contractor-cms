import { BadRequestException } from '@nestjs/common';
import {
  GOV_POLICY_KEY_BANK_FEE_TOLERANCE,
  GOV_POLICY_KEY_CLOSED_PERIOD_MUTATION_POLICY,
  GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD,
  GOV_POLICY_KEY_GL_ROUNDING_TOLERANCE,
  GOV_POLICY_KEY_OVERRIDE_JUSTIFICATION_MIN_LENGTH,
} from '../constants/governance-policy-keys';

export function coerceNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (v && typeof v === 'object' && !Array.isArray(v) && 'value' in v) {
    const inner = (v as { value: unknown }).value;
    if (typeof inner === 'number' && Number.isFinite(inner)) return inner;
  }
  return null;
}

/**
 * GOV-6C — validate JSON payload shape for known governance policy keys (server-side gate).
 */
export function validateGovernancePolicyValue(policyKey: string, currentValue: unknown): void {
  switch (policyKey) {
    case GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD:
    case GOV_POLICY_KEY_BANK_FEE_TOLERANCE:
    case GOV_POLICY_KEY_GL_ROUNDING_TOLERANCE: {
      const n = coerceNumber(currentValue);
      if (n === null || n < 0 || n > 1e9) {
        throw new BadRequestException({
          code: 'INVALID_POLICY_VALUE',
          message: `${policyKey} must be a non-negative number or { "value": number }`,
        });
      }
      return;
    }
    case GOV_POLICY_KEY_OVERRIDE_JUSTIFICATION_MIN_LENGTH: {
      const n = coerceNumber(currentValue);
      if (n === null || !Number.isInteger(n) || n < 1 || n > 10_000) {
        throw new BadRequestException({
          code: 'INVALID_POLICY_VALUE',
          message: `${policyKey} must be an integer between 1 and 10000 (number or { "value": number })`,
        });
      }
      return;
    }
    case GOV_POLICY_KEY_CLOSED_PERIOD_MUTATION_POLICY: {
      if (!currentValue || typeof currentValue !== 'object' || Array.isArray(currentValue)) {
        throw new BadRequestException({
          code: 'INVALID_POLICY_VALUE',
          message: `${policyKey} must be a JSON object with a "mode" field`,
        });
      }
      const mode = String((currentValue as { mode?: unknown }).mode ?? '').toUpperCase();
      if (!['STANDARD', 'GOVERNED_PATHS_ONLY', 'GOVERNED_ONLY'].includes(mode)) {
        throw new BadRequestException({
          code: 'INVALID_POLICY_VALUE',
          message: `${policyKey}.mode must be STANDARD, GOVERNED_PATHS_ONLY, or GOVERNED_ONLY`,
        });
      }
      return;
    }
    default:
      return;
  }
}
