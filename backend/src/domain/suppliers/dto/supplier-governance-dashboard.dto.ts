import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SupplierGovernanceDashboardBucketsDto {
  @ApiProperty({
    description:
      'Oracle-linked suppliers with sourceSyncStatus SYNCED (CMS governance record linked from staging)',
  })
  synced: number;

  @ApiProperty({
    description:
      'Oracle-linked suppliers in PENDING_APPROVAL with incomplete onboarding evidence',
  })
  pendingEvidence: number;

  @ApiProperty({ description: 'Oracle-linked suppliers with lifecycle status ACTIVE' })
  active: number;

  @ApiProperty({ description: 'Oracle-linked suppliers with lifecycle status SUSPENDED' })
  suspended: number;
}

export class SupplierGovernanceDashboardDto {
  @ApiProperty()
  organizationId: string;

  @ApiProperty({ type: SupplierGovernanceDashboardBucketsDto })
  buckets: SupplierGovernanceDashboardBucketsDto;

  @ApiProperty({ description: 'Total Oracle-linked governance suppliers in org' })
  oracleLinkedTotal: number;

  @ApiPropertyOptional({
    description:
      'Effective Oracle connector health (STALE/DISABLED applied; does not imply upstream is healthy)',
  })
  oracleConnectorHealth?: string;

  @ApiPropertyOptional()
  oracleConnectorLastError?: string | null;
}
