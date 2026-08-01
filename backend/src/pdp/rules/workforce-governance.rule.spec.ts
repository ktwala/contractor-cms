import { WorkforceGovernanceRuleEvaluator } from './workforce-governance.rule';
import { PdpReasonCode } from '../pdp.reason-codes';

describe('WorkforceGovernanceRuleEvaluator (PR-CTR-CONNECTOR-1G)', () => {
  const contractorId = 'ctr-1';
  const context = {
    supplierId: 'sup-1',
    contractorId,
    transactionDate: new Date(),
  };

  function buildPrisma(remediation: Record<string, unknown> | null) {
    return {
      contractorGovernanceRemediation: {
        findFirst: jest.fn().mockResolvedValue(remediation),
      },
    } as never;
  }

  it('allows when no active PDP restriction remediation exists', async () => {
    const evaluator = new WorkforceGovernanceRuleEvaluator(buildPrisma(null));
    const result = await evaluator.evaluate('SUBMIT_TIMESHEET', context);
    expect(result.decision).toBe('ALLOW');
  });

  it('blocks restricted actions when remediation has PDP restrictions applied', async () => {
    const evaluator = new WorkforceGovernanceRuleEvaluator(
      buildPrisma({
        id: 'rem-1',
        pdpRestrictionsApplied: true,
        remediationStatus: 'OPEN',
        drift: { driftType: 'GOVERNANCE_LIFECYCLE_CONFLICT' },
      }),
    );
    const result = await evaluator.evaluate('SUBMIT_TIMESHEET', context);
    expect(result.decision).toBe('BLOCK');
    expect(result.reason_code).toBe(PdpReasonCode.WORKFORCE_GOVERNANCE_RESTRICTED);
  });

  it('allows when contractor context is absent', async () => {
    const evaluator = new WorkforceGovernanceRuleEvaluator(
      buildPrisma({
        id: 'rem-1',
        pdpRestrictionsApplied: true,
        remediationStatus: 'OPEN',
      }),
    );
    const result = await evaluator.evaluate('SUBMIT_TIMESHEET', {
      supplierId: 'sup-1',
      transactionDate: new Date(),
    });
    expect(result.decision).toBe('ALLOW');
  });

  it('allows restricted actions after remediation is closed', async () => {
    const evaluator = new WorkforceGovernanceRuleEvaluator(buildPrisma(null));
    const result = await evaluator.evaluate('CREATE_CONTRACTOR', context);
    expect(result.decision).toBe('ALLOW');
  });
});
