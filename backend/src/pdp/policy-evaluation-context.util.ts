import { ContractorSourceDriftType } from '@prisma/client';

/** Governance capability that owns the fact Policy Evaluation read. */
export type PolicyEvaluationSourceTruth =
  | 'Workforce Governance'
  | 'Supplier Governance'
  | 'Workforce Discovery'
  | 'CMS Workforce Registry';

export type PolicyEvaluationStepStatus = 'PASS' | 'FAIL';

/** One authoritative capability evaluated by Policy Evaluation. */
export type PolicyEvaluationStep = {
  capability: PolicyEvaluationSourceTruth | string;
  status: PolicyEvaluationStepStatus;
  /** Governance finding when status is FAIL — owned by the capability, not policy. */
  finding?: string;
};

export type PolicyEvaluationContext = {
  sourceTruth: PolicyEvaluationSourceTruth;
  resolutionAction: string;
  steps: PolicyEvaluationStep[];
};

const POLICY_EVALUATION_CONTEXT_BY_DRIFT: Partial<
  Record<ContractorSourceDriftType, PolicyEvaluationContext>
> = {
  [ContractorSourceDriftType.MISSING_RESPONSIBLE_MANAGER]: {
    sourceTruth: 'Workforce Governance',
    resolutionAction: 'Assign a Responsible Manager',
    steps: [
      {
        capability: 'Workforce Governance',
        status: 'FAIL',
        finding: 'No Responsible Manager assigned',
      },
    ],
  },
  [ContractorSourceDriftType.GOVERNANCE_LIFECYCLE_CONFLICT]: {
    sourceTruth: 'CMS Workforce Registry',
    resolutionAction: 'Resolve workforce lifecycle conflict',
    steps: [
      {
        capability: 'CMS Workforce Registry',
        status: 'FAIL',
        finding: 'Lifecycle conflict (legacy)',
      },
    ],
  },
  [ContractorSourceDriftType.SUPPLIER_LINK_MISSING]: {
    sourceTruth: 'Workforce Discovery',
    resolutionAction: 'Resolve supplier link',
    steps: [
      {
        capability: 'Workforce Discovery',
        status: 'FAIL',
        finding: 'Missing supplier link',
      },
    ],
  },
  [ContractorSourceDriftType.PERSON_CORRELATION_CONFLICT]: {
    sourceTruth: 'Workforce Discovery',
    resolutionAction: 'Resolve worker linking conflict',
    steps: [
      {
        capability: 'Workforce Discovery',
        status: 'FAIL',
        finding: 'Bootstrap identity conflict',
      },
    ],
  },
  [ContractorSourceDriftType.DUPLICATE_PERSON_ANCHOR]: {
    sourceTruth: 'Workforce Discovery',
    resolutionAction: 'Resolve duplicate worker record',
    steps: [
      {
        capability: 'Workforce Discovery',
        status: 'FAIL',
        finding: 'Duplicate person anchor',
      },
    ],
  },
  [ContractorSourceDriftType.WORKER_SOURCE_DRIFT]: {
    sourceTruth: 'Workforce Discovery',
    resolutionAction: 'Review workforce import lineage',
    steps: [
      {
        capability: 'Workforce Discovery',
        status: 'FAIL',
        finding: 'Bootstrap lineage note (informational)',
      },
    ],
  },
  [ContractorSourceDriftType.CHECKPOINT_GAP]: {
    sourceTruth: 'Workforce Discovery',
    resolutionAction: 'Review connector checkpoint gap',
    steps: [
      {
        capability: 'Workforce Discovery',
        status: 'FAIL',
        finding: 'Connector checkpoint gap',
      },
    ],
  },
};

export function resolvePolicyEvaluationContext(
  driftType: string | undefined | null,
): PolicyEvaluationContext | null {
  if (!driftType) return null;
  const fallbackFinding = 'Review workforce governance finding';
  return (
    POLICY_EVALUATION_CONTEXT_BY_DRIFT[driftType as ContractorSourceDriftType] ?? {
      sourceTruth: 'Workforce Governance',
      resolutionAction: fallbackFinding,
      steps: [
        {
          capability: 'Workforce Governance',
          status: 'FAIL',
          finding: fallbackFinding,
        },
      ],
    }
  );
}

export function buildPolicyEvaluationSteps(
  driftType: string | undefined | null,
  driftTypeLabel?: string | null,
): PolicyEvaluationStep[] {
  const context = resolvePolicyEvaluationContext(driftType);
  if (!context) return [];

  const steps = context.steps.map((step) => ({ ...step }));
  const failStep = steps.find((step) => step.status === 'FAIL');
  if (failStep && driftTypeLabel) {
    failStep.finding = driftTypeLabel;
  }
  return steps;
}

export const POLICY_DECISION_RESTRICTED = 'Restricted';
