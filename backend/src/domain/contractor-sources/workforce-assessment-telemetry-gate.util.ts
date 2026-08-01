import { ContractorGovernanceRemediationSummaryDto } from '../contractor-governance/dto/contractor-governance-remediation.dto';
import { WORKFORCE_TELEMETRY_POPULATION_SCOPES } from './workforce-telemetry-population.constants';
import { ContractorSourceDriftSummaryDto } from './dto/contractor-source-drift.dto';
import {
  HcmConnectorCorrelationTelemetryDto,
  HcmConnectorGovernanceTelemetryDto,
  HcmConnectorOperationalRiskTelemetryDto,
  HcmConnectorOperationalWorkforceTelemetryDto,
} from './dto/hcm-connector-telemetry.dto';
import { WorkforceAssessmentLifecyclePhase } from './dto/workforce-assessment-status.dto';

export function isWorkforceAssessmentTelemetryVisible(
  lifecyclePhase: WorkforceAssessmentLifecyclePhase,
): boolean {
  return lifecyclePhase === 'ASSESSMENT_CURRENT';
}

export const EMPTY_HCM_CORRELATION_TELEMETRY: HcmConnectorCorrelationTelemetryDto = {
  highConfidenceMatches: 0,
  lowConfidenceMatches: 0,
  manualReviewRequired: 0,
  correlationConflicts: 0,
  unlinkedWorkers: 0,
};

export const EMPTY_HCM_GOVERNANCE_TELEMETRY: HcmConnectorGovernanceTelemetryDto = {
  pendingVerificationContractors: 0,
  activeContractors: 0,
  blockedContractors: 0,
  terminatedUpstreamButActive: 0,
  missingResponsibleManagerCount: 0,
  missingSupplierLinks: 0,
  workersBlockedPendingSupplierTrust: 0,
  workersBlockedSuspendedSupplier: 0,
  workersAssessed: 0,
  workersNotReadyUnique: 0,
  readinessReasonsDetected: 0,
  duplicateWorkerCount: 0,
};

export const EMPTY_HCM_OPERATIONAL_WORKFORCE_TELEMETRY: HcmConnectorOperationalWorkforceTelemetryDto =
  {
    populationScope: WORKFORCE_TELEMETRY_POPULATION_SCOPES.materializedHcmContractors,
    registryTotal: 0,
    operationallyReady: 0,
    blocked: 0,
    restricted: 0,
    suspendedInactive: 0,
    exited: 0,
  };

export function emptyHcmDriftSummary(organizationId: string): ContractorSourceDriftSummaryDto {
  return {
    organizationId,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    underReview: 0,
    openTotal: 0,
    criticalUnresolvedOver24h: 0,
    lifecycleConflictOpen: 0,
    missingResponsibleManagerOpen: 0,
    identityConflictOpen: 0,
    supplierLinkMissingOpen: 0,
    evaluatedAt: new Date().toISOString(),
  };
}

export function emptyHcmRemediationSummary(
  organizationId: string,
): ContractorGovernanceRemediationSummaryDto {
  return {
    organizationId,
    populationScope: WORKFORCE_TELEMETRY_POPULATION_SCOPES.workforceResolutionTasks,
    activeRemediations: 0,
    criticalUnresolved: 0,
    pdpRestrictionsActive: 0,
    escalationsOverdue: 0,
    missingResponsibleManagerGovernanceOpen: 0,
    evaluatedAt: new Date().toISOString(),
  };
}

export function gateHcmOperationalRiskTelemetry(
  telemetry: HcmConnectorOperationalRiskTelemetryDto,
  lifecyclePhase: WorkforceAssessmentLifecyclePhase,
): HcmConnectorOperationalRiskTelemetryDto {
  if (isWorkforceAssessmentTelemetryVisible(lifecyclePhase)) {
    return telemetry;
  }
  return {
    ...telemetry,
    identityConflictCount: 0,
  };
}
