import { ForbiddenException } from '@nestjs/common';
import { PayrunReadinessGateService } from '../payrun-readiness-gate.service';
import { PayrollReadinessService } from '../../payroll-readiness/payroll-readiness.service';
import { AuditService } from '../../../core/audit/audit.service';
import { PayrunGovernancePolicyResolutionService } from '../payrun-governance-policy-resolution.service';

describe('PayrunReadinessGateService', () => {
  const greenReadiness = {
    payGroupId: 'pg_1',
    payGroupCode: 'MONTHLY',
    countryCode: 'ZA',
    currencyCode: 'ZAR',
    frequency: 'MONTHLY',
    readinessPercent: 100,
    workforceImported: true,
    payrollSupplementalReady: true,
    openingBalancesRequired: false,
    openingBalancesLoaded: true,
    periodsGenerated: true,
    eligibleEmployeeCount: 3,
    missingBankCount: 0,
    missingTaxIdentityCount: 0,
    missingTaxNumberCount: 0,
    missingCompensationCount: 0,
    missingEligibilityCount: 0,
    canCreatePayrun: true,
    blockingReasons: [],
    nextRecommendedAction: 'CREATE_PAYRUN' as const,
  };

  const redReadiness = {
    ...greenReadiness,
    canCreatePayrun: false,
    readinessPercent: 40,
    blockingReasons: [{ code: 'NO_PERIODS' as const, message: 'No periods' }],
    nextRecommendedAction: 'GENERATE_PERIODS' as const,
  };

  function makeService(readiness: typeof greenReadiness) {
    const payrollReadiness = { getPayGroupReadiness: jest.fn().mockResolvedValue(readiness) };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const govPolicy = {
      resolvePayGroupContext: jest.fn().mockResolvedValue({ legalEntityId: 'le1', payGroupId: 'pg_1' }),
      resolveJustificationMinForContext: jest.fn().mockResolvedValue({
        value: 20,
        source: 'default',
        policy_id: null,
        policy_key: 'override.justification_min_length',
      }),
    };
    const gate = new PayrunReadinessGateService(
      payrollReadiness as unknown as PayrollReadinessService,
      audit as unknown as AuditService,
      govPolicy as unknown as PayrunGovernancePolicyResolutionService,
    );
    return { gate, payrollReadiness, audit };
  }

  it('allows when canCreatePayrun is true', async () => {
    const { gate, audit } = makeService(greenReadiness);
    await expect(
      gate.assertPayGroupAllowed('pg_1', { sub: 'u1', permissions: [] }, {}, 'payrun.create'),
    ).resolves.toBeUndefined();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('blocks with PAYROLL_READINESS_GATE_BLOCKED when red and no override', async () => {
    const { gate, audit } = makeService(redReadiness);
    try {
      await gate.assertPayGroupAllowed('pg_1', { sub: 'u1', permissions: ['payrun:create'] }, {}, 'payrun.calculate');
      expect(true).toBe(false);
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(ForbiddenException);
      const res = (e as ForbiddenException).getResponse() as { code?: string; canCreatePayrun?: boolean };
      expect(res.code).toBe('PAYROLL_READINESS_GATE_BLOCKED');
      expect(res.canCreatePayrun).toBe(false);
    }
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('PR-RBAC-GOV-3: broad payrun entitlements without readiness_override still block when red (TENANT_ADMIN-style)', async () => {
    const { gate, audit } = makeService(redReadiness);
    await expect(
      gate.assertPayGroupAllowed(
        'pg_1',
        {
          sub: 'u1',
          permissions: [
            'payrun:read',
            'payrun:create',
            'payrun:edit',
            'payrun:admin',
            'payrun:pay',
            'payrun:post',
          ],
        },
        {},
        'payrun.create',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('allows override with permission + approved header + justification and audits', async () => {
    const { gate, audit } = makeService(redReadiness);
    await expect(
      gate.assertPayGroupAllowed(
        'pg_1',
        { sub: 'u1', permissions: ['payrun:readiness_override'] },
        { overrideHeader: 'approved', justification: 'x'.repeat(20) },
        'payrun.create',
      ),
    ).resolves.toBeUndefined();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        action: 'PAYRUN_READINESS_GATE_OVERRIDE',
        entityType: 'PayGroup',
        entityId: 'pg_1',
        reason: 'readiness_override:payrun.create',
      }),
    );
  });

  it('rejects override when justification is too short', async () => {
    const { gate, audit } = makeService(redReadiness);
    await expect(
      gate.assertPayGroupAllowed(
        'pg_1',
        { sub: 'u1', permissions: ['payrun:readiness_override'] },
        { overrideHeader: 'approved', justification: 'short' },
        'payrun.create',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(audit.log).not.toHaveBeenCalled();
  });
});
