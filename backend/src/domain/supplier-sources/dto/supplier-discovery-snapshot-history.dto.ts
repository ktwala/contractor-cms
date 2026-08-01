import { ApiProperty } from '@nestjs/swagger';

export type SupplierSnapshotAssessmentLabel = 'Pending' | 'Assessed' | 'Not assessed';

export class SupplierDiscoverySnapshotHistoryItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'SYNC-00001' })
  snapshotRef: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty({ example: 'Oracle Supplier Portal' })
  source: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  suppliersDiscovered: number;

  @ApiProperty()
  newSuppliers: number;

  @ApiProperty()
  matchedSuppliers: number;

  @ApiProperty()
  unchangedSuppliers: number;

  @ApiProperty()
  failedSuppliers: number;

  @ApiProperty({
    description:
      'Reconciliation exceptions during acquisition (possible match / conflict), not governance resolution',
  })
  discoveryExceptions: number;

  @ApiProperty({ enum: ['Pending', 'Assessed', 'Not assessed'] })
  assessmentLabel: SupplierSnapshotAssessmentLabel;

  @ApiProperty()
  isLatest: boolean;
}
