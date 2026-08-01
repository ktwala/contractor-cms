/**
 * PR-CTR-2C — sole entry point for HCM → CMS operational writes (GOV-CTR-1).
 * Implementation: PR-CTR-5 (CTR issuance) + PR-CTR-4 (validation engine).
 */

import type { ValidateHcmStagingRowResult } from './migration-pipeline.contract';

export interface GovernanceOverride {
  reason: string;
  actorUserId: string;
  ticketRef?: string;
}

export interface PromoteHcmContractorOptions {
  /** When true, run all checks but do not commit operational writes or CTR sequence. */
  dryRun?: boolean;
  /** Skip blocking sponsor/duplicate gates with audit trail. */
  governanceOverride?: GovernanceOverride;
  /** When false, skip IGA outbox enqueue (default false until cutover). */
  publishToIga?: boolean;
}

export interface PromotionResult {
  success: boolean;
  stagingId: string;
  contractorId?: string;
  contractorBusinessId?: string;
  engagementId?: string;
  validation?: ValidateHcmStagingRowResult;
  errorCode?: string;
  message?: string;
}

/**
 * Promote a validated staging row into Contractor + ContractorEngagement + identity map.
 * @throws Forbidden when GOV-CTR-2/3/4 would be violated without override.
 */
export interface PromoteHcmContractorToCms {
  execute(
    stagingId: string,
    options?: PromoteHcmContractorOptions,
  ): Promise<PromotionResult>;
}

export const PROMOTE_HCM_CONTRACTOR_TOKEN = Symbol(
  'PromoteHcmContractorToCms',
);
