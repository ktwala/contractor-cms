import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WORKFORCE_TELEMETRY_POPULATION_SCOPES } from '../workforce-telemetry-population.constants';

export class HcmConnectorSyncTelemetryDto {
  @ApiProperty()
  totalSyncRuns: number;

  @ApiProperty()
  successfulSyncRuns: number;

  @ApiProperty()
  failedSyncRuns: number;

  @ApiProperty()
  partialSyncRuns: number;

  @ApiProperty()
  runningSyncRuns: number;

  @ApiPropertyOptional({ description: 'Milliseconds; null when no completed run' })
  lastSyncDurationMs: number | null;

  @ApiPropertyOptional({ description: 'Milliseconds; null when no completed runs' })
  averageSyncDurationMs: number | null;

  @ApiProperty({ description: 'Cumulative workers imported across sync runs' })
  workersImported: number;

  @ApiProperty()
  workersMatched: number;

  @ApiProperty()
  workersNew: number;

  @ApiProperty()
  workersFailed: number;

  @ApiProperty()
  correlationFailures: number;

  @ApiProperty({
    description: 'Staging rows not yet promoted to governance contractors',
  })
  stagingBacklog: number;
}

export class HcmConnectorCorrelationTelemetryDto {
  @ApiProperty()
  highConfidenceMatches: number;

  @ApiProperty()
  lowConfidenceMatches: number;

  @ApiProperty()
  manualReviewRequired: number;

  @ApiProperty()
  correlationConflicts: number;

  @ApiProperty()
  unlinkedWorkers: number;
}

export class HcmConnectorGovernanceTelemetryDto {
  @ApiProperty({
    description: 'Staging / migration rows awaiting verification or promotion',
  })
  pendingVerificationContractors: number;

  @ApiProperty({
    description: 'HCM-linked contractors marked active in CMS',
  })
  activeContractors: number;

  @ApiProperty({
    description: 'HCM-linked contractors inactive or quarantined in CMS',
  })
  blockedContractors: number;

  @ApiProperty({
    description:
      'Legacy HCM-authority signal: upstream terminated but active in CMS (HCM_ONLY tenants only)',
  })
  terminatedUpstreamButActive: number;

  @ApiProperty({
    description:
      'CMS operational governance: active imported contractors without sponsor assignment',
  })
  missingResponsibleManagerCount: number;

  @ApiProperty()
  missingSupplierLinks: number;

  @ApiProperty({
    description:
      'Discovered workers linked to suppliers awaiting Operational Trust (PENDING_APPROVAL)',
  })
  workersBlockedPendingSupplierTrust: number;

  @ApiProperty({
    description:
      'Discovered workers linked to suppliers with Operational Trust Suspended',
  })
  workersBlockedSuspendedSupplier: number;

  @ApiProperty({
    description: 'Worker records in the latest discovery snapshot assessed for readiness',
  })
  workersAssessed: number;

  @ApiProperty({
    description:
      'Distinct worker records with at least one readiness-blocking reason (reasons may overlap across workers)',
  })
  workersNotReadyUnique: number;

  @ApiProperty({
    description:
      'Total readiness reasons detected — may exceed workers not ready because one worker can have multiple reasons',
  })
  readinessReasonsDetected: number;

  @ApiProperty({
    description: 'Duplicate worker correlation conflicts in the discovery snapshot',
  })
  duplicateWorkerCount: number;
}

export class HcmConnectorOperationalRiskTelemetryDto {
  @ApiProperty({
    description: '1 when effective REST connector health is STALE, else 0',
  })
  staleConnectorCount: number;

  @ApiProperty()
  failedSyncRuns: number;

  @ApiProperty({
    description: 'Failed incremental REST runs (checkpoint uncertainty signal)',
  })
  checkpointGapCount: number;

  @ApiProperty()
  identityConflictCount: number;
}

export class HcmConnectorOperationalWorkforceTelemetryDto {
  @ApiProperty({
    description: 'Human-readable population for operator-facing copy',
    example: WORKFORCE_TELEMETRY_POPULATION_SCOPES.materializedHcmContractors,
  })
  populationScope: string;

  @ApiProperty({
    description:
      'Total materialized HCM-linked contractors in the CMS registry (denominator for lifecycle tiles)',
  })
  registryTotal: number;

  @ApiProperty({
    description:
      'HCM-linked contractors in ACTIVE workforce state in the CMS registry (not the staging assessment population)',
  })
  operationallyReady: number;

  @ApiProperty({
    description: 'Workers blocked by governance decisions (rejected or blacklisted)',
  })
  blocked: number;

  @ApiProperty({
    description:
      'Materialized contractors with an active Restrict policy decision from Policy Evaluation',
  })
  restricted: number;

  @ApiProperty({
    description: 'Workers suspended or marked inactive without exit',
  })
  suspendedInactive: number;

  @ApiProperty({
    description: 'Workers terminated / exited from operational workforce',
  })
  exited: number;
}

export class HcmConnectorTelemetryResponseDto {
  @ApiProperty()
  organizationId: string;

  @ApiProperty({ type: HcmConnectorSyncTelemetryDto })
  connector: HcmConnectorSyncTelemetryDto;

  @ApiProperty({ type: HcmConnectorCorrelationTelemetryDto })
  correlation: HcmConnectorCorrelationTelemetryDto;

  @ApiProperty({ type: HcmConnectorGovernanceTelemetryDto })
  governance: HcmConnectorGovernanceTelemetryDto;

  @ApiProperty({ type: HcmConnectorOperationalRiskTelemetryDto })
  operationalRisk: HcmConnectorOperationalRiskTelemetryDto;

  @ApiProperty({ type: HcmConnectorOperationalWorkforceTelemetryDto })
  operationalWorkforce: HcmConnectorOperationalWorkforceTelemetryDto;

  @ApiProperty()
  evaluatedAt: string;
}
