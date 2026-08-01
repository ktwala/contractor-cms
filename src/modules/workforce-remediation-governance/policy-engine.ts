export interface ApprovalPolicy {
  threshold: number;
  approverRole: string;
  maxBatchSize: number;
}

const DEFAULT_MAX_BATCH = 200;

export const APPROVAL_POLICIES: Record<string, ApprovalPolicy> = {
  BULK_ASSIGN_MANAGER: {
    threshold: 5,
    approverRole: 'HR_ADMIN',
    maxBatchSize: DEFAULT_MAX_BATCH,
  },
  BULK_CREATE_EMPLOYMENTS: {
    threshold: 3,
    approverRole: 'HR_ADMIN',
    maxBatchSize: 50,
  },
  BULK_CREATE_ASSIGNMENTS: {
    threshold: 10,
    approverRole: 'HR_ADMIN',
    maxBatchSize: DEFAULT_MAX_BATCH,
  },
  BULK_ASSIGN_ORG_UNIT: {
    threshold: 10,
    approverRole: 'HR_ADMIN',
    maxBatchSize: DEFAULT_MAX_BATCH,
  },
  BULK_ASSIGN_COST_CENTER: {
    threshold: 15,
    approverRole: 'HR_ADMIN',
    maxBatchSize: DEFAULT_MAX_BATCH,
  },
};

export interface PolicyEvaluation {
  requiresApproval: boolean;
  reason?: string;
  policy?: ApprovalPolicy;
  blocked?: boolean;
  blockReason?: string;
}

export function evaluatePolicy(
  actionType: string,
  recordsAffected: number,
): PolicyEvaluation {
  const policy = APPROVAL_POLICIES[actionType];
  if (!policy) {
    return { requiresApproval: false };
  }

  // Hard-block if batch size exceeds max
  if (recordsAffected > policy.maxBatchSize) {
    return {
      requiresApproval: false,
      blocked: true,
      blockReason: `Batch size ${recordsAffected} exceeds maximum of ${policy.maxBatchSize} for ${actionType}. Apply narrower filters.`,
      policy,
    };
  }

  if (recordsAffected >= policy.threshold) {
    return {
      requiresApproval: true,
      reason: `${actionType} affecting ${recordsAffected} records exceeds threshold of ${policy.threshold}`,
      policy,
    };
  }

  return { requiresApproval: false };
}

export function assertBatchSizePolicy(actionType: string, count: number) {
  const policy = APPROVAL_POLICIES[actionType];
  const max = policy?.maxBatchSize ?? DEFAULT_MAX_BATCH;
  if (count > max) {
    throw new Error(`Batch size ${count} exceeds maximum of ${max} for ${actionType}. Apply narrower filters.`);
  }
}

/**
 * Cross-legal-entity guard: checks that all affected employees belong to the same
 * legal entity when doing LE-sensitive operations (employment creation).
 */
export function assertSingleLegalEntity(legalEntityIds: string[], actionType: string) {
  if (legalEntityIds.length > 1 && actionType === 'BULK_CREATE_EMPLOYMENTS') {
    throw new Error(
      `Cross-legal-entity bulk operations are not allowed for ${actionType}. ` +
      `Filter to a single legal entity. Found: ${legalEntityIds.join(', ')}`,
    );
  }
}
