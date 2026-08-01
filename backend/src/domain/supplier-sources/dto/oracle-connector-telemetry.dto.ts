import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OracleConnectorSyncTelemetryDto {
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

  @ApiProperty()
  recordsImported: number;

  @ApiProperty()
  recordsMatched: number;

  @ApiProperty()
  recordsNew: number;

  @ApiProperty()
  recordsFailed: number;

  @ApiProperty({
    description: 'Staging rows not yet promoted (excludes IMPORTED/REJECTED)',
  })
  stagingBacklogCount: number;
}

export class OracleConnectorGovernanceTelemetryDto {
  @ApiProperty()
  pendingEvidenceSuppliers: number;

  @ApiProperty()
  activeSuppliers: number;

  @ApiProperty()
  suspendedSuppliers: number;

  @ApiProperty({
    description: '1 when effective connector health is STALE for this org, else 0',
  })
  staleConnectorCount: number;

  @ApiPropertyOptional({
    description: 'Age in hours of oldest promotable staging row; null when queue empty',
  })
  promotionQueueAgeHours: number | null;

  @ApiProperty()
  unresolvedPossibleMatches: number;

  @ApiProperty()
  reconciliationFailures: number;
}

export class OracleConnectorDriftTelemetryDto {
  @ApiProperty({
    description: 'Oracle-linked suppliers not in SYNCED source sync state',
  })
  supplierSourceDriftCount: number;

  @ApiProperty({
    description: 'Promotable staging rows without a linked CMS governance record',
  })
  missingSourceRecords: number;

  @ApiProperty()
  duplicateExternalIds: number;

  @ApiProperty()
  promotionFailures: number;
}

export class OracleConnectorTelemetryResponseDto {
  @ApiProperty()
  organizationId: string;

  @ApiProperty({ type: OracleConnectorSyncTelemetryDto })
  connector: OracleConnectorSyncTelemetryDto;

  @ApiProperty({ type: OracleConnectorGovernanceTelemetryDto })
  governance: OracleConnectorGovernanceTelemetryDto;

  @ApiProperty({ type: OracleConnectorDriftTelemetryDto })
  drift: OracleConnectorDriftTelemetryDto;

  @ApiProperty()
  evaluatedAt: string;
}
