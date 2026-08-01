import {
  HcmContractorCorrelationConfidence,
  HcmContractorCorrelationMatchStatus,
  HcmMigrationPipelineStatus,
  HcmQuarantineReasonCode,
  SupplierStatus,
} from '@prisma/client';
import {
  matchStagingVendorToSupplier,
  vendorFromNormalizedPayload,
  type SupplierWorkforceLinkRef,
} from '../suppliers/supplier-workforce-link.util';

export type UntrustedSupplierRef = SupplierWorkforceLinkRef;

export type StagingReadinessRow = {
  id: string;
  normalizedPayloadJson: unknown;
  correlationMatchStatus: HcmContractorCorrelationMatchStatus;
  correlationConfidence: HcmContractorCorrelationConfidence | null;
  proposedContractorId: string | null;
  proposedContractor: {
    isActive: boolean;
    engagements: Array<{ responsibleManagerEmployeeId: string | null }>;
  } | null;
  quarantineEntries: Array<{ reasonCode: HcmQuarantineReasonCode }>;
};

export type WorkforceReadinessSummary = {
  workersAssessed: number;
  workersNotReadyUnique: number;
  readinessReasonsDetected: number;
  missingSupplierLinks: number;
  workersBlockedPendingSupplierTrust: number;
  workersBlockedSuspendedSupplier: number;
  missingResponsibleManagerCount: number;
  duplicateWorkerCount: number;
  unlinkedWorkers: number;
  manualReviewRequired: number;
};

function rowHasMissingSupplierLink(row: StagingReadinessRow): boolean {
  if (!vendorFromNormalizedPayload(row.normalizedPayloadJson)) {
    return true;
  }
  return row.quarantineEntries.some(
    (entry) => entry.reasonCode === HcmQuarantineReasonCode.SUPPLIER_UNRESOLVED,
  );
}

function rowHasMissingResponsibleManager(row: StagingReadinessRow): boolean {
  const contractor = row.proposedContractor;
  if (!contractor?.isActive) {
    return false;
  }
  const activeEngagements = contractor.engagements ?? [];
  if (activeEngagements.length === 0) {
    return true;
  }
  return !activeEngagements.some((e) => Boolean(e.responsibleManagerEmployeeId?.trim()));
}

function evaluateStagingReadinessFlags(
  row: StagingReadinessRow,
  untrustedSuppliers: UntrustedSupplierRef[],
): {
  missingSupplierLink: boolean;
  pendingSupplierTrust: boolean;
  suspendedSupplierTrust: boolean;
  unlinkedWorker: boolean;
  duplicateWorker: boolean;
  manualReviewRequired: boolean;
  missingResponsibleManager: boolean;
} {
  const vendor = vendorFromNormalizedPayload(row.normalizedPayloadJson);
  const matchedSupplier = vendor
    ? matchStagingVendorToSupplier(vendor, untrustedSuppliers)
    : undefined;

  const missingSupplierLink = rowHasMissingSupplierLink(row);
  const pendingSupplierTrust = matchedSupplier?.status === SupplierStatus.PENDING_APPROVAL;
  const suspendedSupplierTrust = matchedSupplier?.status === SupplierStatus.SUSPENDED;
  const unlinkedWorker =
    (row.correlationMatchStatus === HcmContractorCorrelationMatchStatus.NEW ||
      row.correlationMatchStatus === HcmContractorCorrelationMatchStatus.UNMATCHED) &&
    row.proposedContractorId == null;
  const duplicateWorker =
    row.correlationMatchStatus === HcmContractorCorrelationMatchStatus.CONFLICT;
  const manualReviewRequired =
    row.correlationConfidence === HcmContractorCorrelationConfidence.MANUAL_REVIEW ||
    row.correlationMatchStatus === HcmContractorCorrelationMatchStatus.CONFLICT;
  const missingResponsibleManager = rowHasMissingResponsibleManager(row);

  return {
    missingSupplierLink,
    pendingSupplierTrust,
    suspendedSupplierTrust,
    unlinkedWorker,
    duplicateWorker,
    manualReviewRequired,
    missingResponsibleManager,
  };
}

export function summarizeWorkforceReadinessFromStaging(
  stagingRows: StagingReadinessRow[],
  untrustedSuppliers: UntrustedSupplierRef[],
  trustCounts?: {
    workersBlockedPendingSupplierTrust: number;
    workersBlockedSuspendedSupplier: number;
  },
): WorkforceReadinessSummary {
  const summary: WorkforceReadinessSummary = {
    workersAssessed: stagingRows.length,
    workersNotReadyUnique: 0,
    readinessReasonsDetected: 0,
    missingSupplierLinks: 0,
    workersBlockedPendingSupplierTrust: trustCounts?.workersBlockedPendingSupplierTrust ?? 0,
    workersBlockedSuspendedSupplier: trustCounts?.workersBlockedSuspendedSupplier ?? 0,
    missingResponsibleManagerCount: 0,
    duplicateWorkerCount: 0,
    unlinkedWorkers: 0,
    manualReviewRequired: 0,
  };

  for (const row of stagingRows) {
    const flags = evaluateStagingReadinessFlags(row, untrustedSuppliers);
    const reasonCount = Object.values(flags).filter(Boolean).length;
    if (reasonCount > 0) {
      summary.workersNotReadyUnique += 1;
      summary.readinessReasonsDetected += reasonCount;
    }
    if (flags.missingSupplierLink) summary.missingSupplierLinks += 1;
    if (flags.missingResponsibleManager) summary.missingResponsibleManagerCount += 1;
    if (flags.duplicateWorker) summary.duplicateWorkerCount += 1;
    if (flags.unlinkedWorker) summary.unlinkedWorkers += 1;
    if (flags.manualReviewRequired) summary.manualReviewRequired += 1;
  }

  return summary;
}

/** Staging rows still in the discovery / assessment pipeline (not promoted). */
export const WORKFORCE_READINESS_STAGING_PIPELINES: HcmMigrationPipelineStatus[] = [
  HcmMigrationPipelineStatus.EXTRACTED,
  HcmMigrationPipelineStatus.NORMALIZED,
  HcmMigrationPipelineStatus.VALIDATED,
  HcmMigrationPipelineStatus.QUARANTINED,
  HcmMigrationPipelineStatus.APPROVED,
  HcmMigrationPipelineStatus.CTR_ISSUED,
];
