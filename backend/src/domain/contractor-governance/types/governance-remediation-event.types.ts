/**
 * PR-CTR-CONNECTOR-1G — downstream governance contract (no Soffid connector in this PR).
 */
export type GovernanceRemediationEvent = {
  eventType: string;
  organizationId: string;
  contractorId: string | null;
  driftId: string;
  remediationId: string;
  severity: string;
  recommendedActions: string[];
  emittedAt: string;
};
