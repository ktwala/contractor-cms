import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SupplierSourceStagingMatchStatus } from '@prisma/client';

export class OracleStagingMatchedSupplierDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  jurisdictionCode: string;
}

export class OracleStagingRowDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  externalSupplierId: string;

  @ApiPropertyOptional()
  supplierNumber: string | null;

  @ApiProperty()
  name: string;

  @ApiProperty()
  countryCode: string;

  @ApiPropertyOptional()
  taxRegistrationNumber: string | null;

  @ApiProperty({ enum: SupplierSourceStagingMatchStatus })
  matchStatus: SupplierSourceStagingMatchStatus;

  @ApiPropertyOptional()
  matchReason: string | null;

  @ApiPropertyOptional()
  proposedSupplierId: string | null;

  @ApiPropertyOptional({ type: OracleStagingMatchedSupplierDto })
  matchedSupplier: OracleStagingMatchedSupplierDto | null;

  @ApiProperty()
  importedAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class OracleImportSummaryDto {
  @ApiProperty()
  imported: number;

  @ApiProperty()
  matched: number;

  @ApiProperty()
  possibleMatch: number;

  @ApiProperty()
  new: number;

  @ApiProperty()
  conflict: number;
}

export class OracleImportResponseDto {
  @ApiProperty({ type: OracleImportSummaryDto })
  summary: OracleImportSummaryDto;

  @ApiProperty({ type: [OracleStagingRowDto] })
  rows: OracleStagingRowDto[];

  @ApiPropertyOptional({ description: 'PR-CMS-CONNECTOR-1B sync run ledger id' })
  syncRunId?: string;

  @ApiPropertyOptional()
  syncRunStatus?: string;

  @ApiPropertyOptional({ enum: ['HEALTHY', 'DEGRADED', 'STALE', 'AUTH_FAILED', 'RATE_LIMITED', 'DISABLED', 'UNKNOWN'] })
  connectorHealth?: string;
}

export class PaginatedOracleStagingResponseDto {
  @ApiProperty({ type: [OracleStagingRowDto] })
  data: OracleStagingRowDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
