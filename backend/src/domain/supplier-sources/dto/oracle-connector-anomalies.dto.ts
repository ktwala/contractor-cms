import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SupplierSourceStagingMatchStatus } from '@prisma/client';

export class OracleConnectorAnomalyItemDto {
  @ApiProperty()
  code: string;

  @ApiProperty()
  severity: 'low' | 'medium' | 'high';

  @ApiProperty()
  message: string;

  @ApiProperty()
  count: number;

  @ApiPropertyOptional()
  sampleExternalSupplierId?: string | null;

  @ApiPropertyOptional()
  sampleStagingId?: string | null;
}

export class OracleConnectorAnomaliesResponseDto {
  @ApiProperty()
  organizationId: string;

  @ApiProperty({ type: [OracleConnectorAnomalyItemDto] })
  anomalies: OracleConnectorAnomalyItemDto[];

  @ApiProperty()
  totalAnomalyCount: number;

  @ApiProperty()
  evaluatedAt: string;
}

export class OracleSyncRunListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  mode: string;

  @ApiProperty()
  startedAt: string;

  @ApiPropertyOptional()
  finishedAt: string | null;

  @ApiPropertyOptional()
  durationMs: number | null;

  @ApiProperty()
  importedCount: number;

  @ApiProperty()
  matchedCount: number;

  @ApiProperty()
  newCount: number;

  @ApiProperty()
  failedCount: number;

  @ApiPropertyOptional()
  errorCode: string | null;

  @ApiPropertyOptional()
  errorMessage: string | null;

  @ApiPropertyOptional()
  checkpointFrom: string | null;

  @ApiPropertyOptional()
  checkpointTo: string | null;

  @ApiPropertyOptional()
  nextCursor: string | null;
}

export class PaginatedOracleSyncRunsResponseDto {
  @ApiProperty({ type: [OracleSyncRunListItemDto] })
  data: OracleSyncRunListItemDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
