import { ApiProperty } from '@nestjs/swagger';
import { HcmConnectorHealthSnapshot } from '../../../integration/oracle-hcm/oracle-hcm-health.service';
import {
  HcmConnectorCorrelationTelemetryDto,
  HcmConnectorGovernanceTelemetryDto,
  HcmConnectorOperationalRiskTelemetryDto,
  HcmConnectorOperationalWorkforceTelemetryDto,
  HcmConnectorSyncTelemetryDto,
} from './hcm-connector-telemetry.dto';
import { ContractorSourceDriftSummaryDto } from './contractor-source-drift.dto';
import { ContractorGovernanceRemediationSummaryDto } from '../../contractor-governance/dto/contractor-governance-remediation.dto';
import { WorkforceAssessmentStatusDto } from './workforce-assessment-status.dto';
import { WorkforceDiscoverySnapshotHistoryItemDto } from './workforce-discovery-snapshot-history.dto';

export class HcmSyncRunListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  mode: string;

  @ApiProperty()
  startedAt: string;

  @ApiProperty({ nullable: true })
  finishedAt: string | null;

  @ApiProperty({ nullable: true })
  durationMs: number | null;

  @ApiProperty()
  importedCount: number;

  @ApiProperty()
  matchedCount: number;

  @ApiProperty()
  correlationFailures: number;

  @ApiProperty()
  failedCount: number;

  @ApiProperty({ nullable: true })
  errorCode: string | null;
}

export class HcmConnectorOperationsDashboardDto {
  @ApiProperty()
  organizationId: string;

  @ApiProperty({
    description: 'Effective REST connector health (file replay does not imply HEALTHY)',
  })
  connectorHealth: HcmConnectorHealthSnapshot;

  @ApiProperty({ type: HcmConnectorSyncTelemetryDto })
  syncTelemetry: HcmConnectorSyncTelemetryDto;

  @ApiProperty({ type: HcmConnectorCorrelationTelemetryDto })
  correlationTelemetry: HcmConnectorCorrelationTelemetryDto;

  @ApiProperty({ type: HcmConnectorGovernanceTelemetryDto })
  governanceTelemetry: HcmConnectorGovernanceTelemetryDto;

  @ApiProperty({ type: HcmConnectorOperationalRiskTelemetryDto })
  operationalRiskTelemetry: HcmConnectorOperationalRiskTelemetryDto;

  @ApiProperty({ type: HcmConnectorOperationalWorkforceTelemetryDto })
  operationalWorkforceTelemetry: HcmConnectorOperationalWorkforceTelemetryDto;

  @ApiProperty({ type: ContractorSourceDriftSummaryDto })
  driftSummary: ContractorSourceDriftSummaryDto;

  @ApiProperty({ type: ContractorGovernanceRemediationSummaryDto })
  remediationSummary: ContractorGovernanceRemediationSummaryDto;

  @ApiProperty({ type: [HcmSyncRunListItemDto] })
  recentSyncRuns: HcmSyncRunListItemDto[];

  @ApiProperty({
    nullable: true,
    description:
      'ISO timestamp of workforce migration cutover, or null when not yet set. ' +
      'Null = bootstrap lineage is unconditionally visible for migration review.',
  })
  workforceMigrationCutoverAt: string | null;

  @ApiProperty({ type: WorkforceAssessmentStatusDto })
  workforceAssessment: WorkforceAssessmentStatusDto;

  @ApiProperty({ type: [WorkforceDiscoverySnapshotHistoryItemDto] })
  discoverySnapshotHistory: WorkforceDiscoverySnapshotHistoryItemDto[];

  @ApiProperty()
  evaluatedAt: string;
}
