import { ApiProperty } from '@nestjs/swagger';
import { OracleConnectorHealthResponseDto } from './oracle-connector-health.dto';
import { OracleConnectorAnomaliesResponseDto } from './oracle-connector-anomalies.dto';
import {
  OracleConnectorGovernanceTelemetryDto,
  OracleConnectorSyncTelemetryDto,
} from './oracle-connector-telemetry.dto';
import { SupplierGovernanceDashboardBucketsDto } from '../../suppliers/dto/supplier-governance-dashboard.dto';
import { OracleSyncRunListItemDto } from './oracle-connector-anomalies.dto';
import { SupplierSourceDriftSummaryDto } from './supplier-source-drift.dto';
import { SupplierSyncAssessmentStatusDto } from './supplier-sync-assessment-status.dto';
import { SupplierDiscoverySnapshotHistoryItemDto } from './supplier-discovery-snapshot-history.dto';

export class OracleConnectorOperationsDashboardDto {
  @ApiProperty()
  organizationId: string;

  @ApiProperty({
    description: 'Connector health reflects upstream truth, not governance completeness',
  })
  connectorHealth: OracleConnectorHealthResponseDto;

  @ApiProperty({ type: OracleConnectorSyncTelemetryDto })
  syncTelemetry: OracleConnectorSyncTelemetryDto;

  @ApiProperty({ type: OracleConnectorGovernanceTelemetryDto })
  governanceTelemetry: OracleConnectorGovernanceTelemetryDto;

  @ApiProperty({ type: SupplierGovernanceDashboardBucketsDto })
  governanceBuckets: SupplierGovernanceDashboardBucketsDto;

  @ApiProperty()
  oracleLinkedTotal: number;

  @ApiProperty({ type: OracleConnectorAnomaliesResponseDto })
  anomalies: OracleConnectorAnomaliesResponseDto;

  @ApiProperty({ type: SupplierSourceDriftSummaryDto })
  driftSummary: SupplierSourceDriftSummaryDto;

  @ApiProperty({
    type: [OracleSyncRunListItemDto],
    description: 'Most recent sync runs (derived from ledger)',
  })
  recentSyncRuns: OracleSyncRunListItemDto[];

  @ApiProperty({ type: SupplierSyncAssessmentStatusDto })
  supplierSyncAssessment: SupplierSyncAssessmentStatusDto;

  @ApiProperty({ type: [SupplierDiscoverySnapshotHistoryItemDto] })
  supplierDiscoverySnapshotHistory: SupplierDiscoverySnapshotHistoryItemDto[];

  @ApiProperty()
  evaluatedAt: string;
}
