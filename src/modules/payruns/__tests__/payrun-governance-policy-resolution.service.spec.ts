import { GovernancePolicyScope } from '@prisma/client';
import { PayrunGovernancePolicyResolutionService } from '../payrun-governance-policy-resolution.service';
import { GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD } from '../../payroll-cycle/constants/governance-policy-keys';

describe('PayrunGovernancePolicyResolutionService (GOV-6B / GOV-6B-LOCK)', () => {
  it('picks PAY_GROUP over LEGAL_ENTITY over GLOBAL for numeric policy', async () => {
    const prisma = {
      payrollGovernancePolicy: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'g',
            policyKey: GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD,
            scope: GovernancePolicyScope.GLOBAL,
            currentValue: { value: 0.1 },
          },
          {
            id: 'le',
            policyKey: GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD,
            scope: GovernancePolicyScope.LEGAL_ENTITY,
            currentValue: 0.08,
          },
          {
            id: 'pg',
            policyKey: GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD,
            scope: GovernancePolicyScope.PAY_GROUP,
            currentValue: { value: 0.02 },
          },
        ]),
      },
    };
    const svc = new PayrunGovernancePolicyResolutionService(prisma as any);
    const r = await svc.resolveNumberForContext(
      GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD,
      { legalEntityId: 'le1', payGroupId: 'pg1' },
      0.05,
    );
    expect(r.value).toBe(0.02);
    expect(r.source).toBe('registry');
    expect(r.policy_id).toBe('pg');
  });

  it('falls back to default when no policy rows', async () => {
    const prisma = {
      payrollGovernancePolicy: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const svc = new PayrunGovernancePolicyResolutionService(prisma as any);
    const r = await svc.resolveNumberForContext(
      GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD,
      { legalEntityId: 'le1', payGroupId: 'pg1' },
      0.05,
    );
    expect(r.value).toBe(0.05);
    expect(r.source).toBe('default');
    expect(r.policy_id).toBeNull();
  });
});
