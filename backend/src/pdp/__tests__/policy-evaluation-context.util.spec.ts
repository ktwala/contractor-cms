import { ContractorSourceDriftType } from '@prisma/client';
import {
  POLICY_DECISION_RESTRICTED,
  buildPolicyEvaluationSteps,
  resolvePolicyEvaluationContext,
} from '../policy-evaluation-context.util';

describe('policy-evaluation-context.util', () => {
  it('maps missing responsible manager to Workforce Governance', () => {
    const ctx = resolvePolicyEvaluationContext(
      ContractorSourceDriftType.MISSING_RESPONSIBLE_MANAGER,
    );
    expect(ctx).toMatchObject({
      sourceTruth: 'Workforce Governance',
      resolutionAction: 'Assign a Responsible Manager',
      steps: [
        {
          capability: 'Workforce Governance',
          status: 'FAIL',
          finding: 'No Responsible Manager assigned',
        },
      ],
    });
  });

  it('maps supplier link missing to Workforce Discovery', () => {
    const ctx = resolvePolicyEvaluationContext(
      ContractorSourceDriftType.SUPPLIER_LINK_MISSING,
    );
    expect(ctx?.sourceTruth).toBe('Workforce Discovery');
    expect(ctx?.resolutionAction).toContain('supplier link');
    expect(ctx?.steps[0]).toMatchObject({ status: 'FAIL', capability: 'Workforce Discovery' });
  });

  it('builds steps with operator drift label on the failing step', () => {
    const steps = buildPolicyEvaluationSteps(
      ContractorSourceDriftType.MISSING_RESPONSIBLE_MANAGER,
      'No Responsible Manager assigned',
    );
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      capability: 'Workforce Governance',
      status: 'FAIL',
      finding: 'No Responsible Manager assigned',
    });
  });
});
