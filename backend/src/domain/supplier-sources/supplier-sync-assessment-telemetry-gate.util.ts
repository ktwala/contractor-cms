import { SupplierSourceDriftSummaryDto } from './dto/supplier-source-drift.dto';
import {
  OracleConnectorDriftTelemetryDto,
  OracleConnectorGovernanceTelemetryDto,
} from './dto/oracle-connector-telemetry.dto';
import { SupplierGovernanceDashboardBucketsDto } from '../suppliers/dto/supplier-governance-dashboard.dto';
import { SupplierSyncAssessmentLifecyclePhase } from './dto/supplier-sync-assessment-status.dto';

export function isSupplierAssessmentTelemetryVisible(
  lifecyclePhase: SupplierSyncAssessmentLifecyclePhase,
): boolean {
  return lifecyclePhase === 'ASSESSMENT_CURRENT';
}

export const EMPTY_ORACLE_GOVERNANCE_TELEMETRY: OracleConnectorGovernanceTelemetryDto = {
  pendingEvidenceSuppliers: 0,
  activeSuppliers: 0,
  suspendedSuppliers: 0,
  staleConnectorCount: 0,
  promotionQueueAgeHours: null,
  unresolvedPossibleMatches: 0,
  reconciliationFailures: 0,
};

export const EMPTY_ORACLE_DRIFT_TELEMETRY: OracleConnectorDriftTelemetryDto = {
  supplierSourceDriftCount: 0,
  missingSourceRecords: 0,
  duplicateExternalIds: 0,
  promotionFailures: 0,
};

export const EMPTY_SUPPLIER_GOVERNANCE_BUCKETS: SupplierGovernanceDashboardBucketsDto = {
  synced: 0,
  pendingEvidence: 0,
  active: 0,
  suspended: 0,
};

export function emptySupplierDriftSummary(organizationId: string): SupplierSourceDriftSummaryDto {
  return {
    organizationId,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    underReview: 0,
    openTotal: 0,
    criticalUnresolvedOver72h: 0,
    evaluatedAt: new Date().toISOString(),
  };
}
