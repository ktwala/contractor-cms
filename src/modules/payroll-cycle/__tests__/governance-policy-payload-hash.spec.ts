import { computeGovernancePolicyImpactPayloadHash } from '../services/governance-policy-payload-hash';
import { GovernancePolicyScope } from '@prisma/client';

describe('computeGovernancePolicyImpactPayloadHash (GOV-7A)', () => {
  it('is stable for the same logical payload', () => {
    const a = computeGovernancePolicyImpactPayloadHash({
      policy_key: 'financial_control.net_variance_threshold',
      scope: GovernancePolicyScope.PAY_GROUP,
      legal_entity_id: 'le-1',
      pay_group_id: 'pg-1',
      current_value: { value: 0.1 },
      effective_from_iso: new Date('2026-05-08').toISOString(),
    });
    const b = computeGovernancePolicyImpactPayloadHash({
      policy_key: 'financial_control.net_variance_threshold',
      scope: GovernancePolicyScope.PAY_GROUP,
      legal_entity_id: 'le-1',
      pay_group_id: 'pg-1',
      current_value: { value: 0.1 },
      effective_from_iso: new Date('2026-05-08').toISOString(),
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('matches when current_value key order differs (canonicalized)', () => {
    const iso = new Date('2026-05-08').toISOString();
    const h1 = computeGovernancePolicyImpactPayloadHash({
      policy_key: 'k',
      scope: GovernancePolicyScope.GLOBAL,
      legal_entity_id: null,
      pay_group_id: null,
      current_value: { value: 1, note: 'x' },
      effective_from_iso: iso,
    });
    const h2 = computeGovernancePolicyImpactPayloadHash({
      policy_key: 'k',
      scope: GovernancePolicyScope.GLOBAL,
      legal_entity_id: null,
      pay_group_id: null,
      current_value: { note: 'x', value: 1 },
      effective_from_iso: iso,
    });
    expect(h1).toBe(h2);
  });
});
