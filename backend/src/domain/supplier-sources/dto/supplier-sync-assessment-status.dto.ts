import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type SupplierSyncAssessmentLifecyclePhase =
  | 'SYNCHRONIZATION_PENDING'
  | 'ASSESSMENT_PENDING'
  | 'ASSESSMENT_CURRENT';

export class SupplierSyncSnapshotDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'SYNC-00015' })
  snapshotRef: string;

  @ApiProperty()
  importedCount: number;

  @ApiProperty()
  finishedAt: string;
}

export class SupplierLastAssessmentDto {
  @ApiProperty()
  syncRunId: string;

  @ApiProperty({ example: 'SYNC-00015' })
  snapshotRef: string;

  @ApiProperty()
  assessedAt: string;
}

export class SupplierSyncAssessmentStatusDto {
  @ApiProperty({
    enum: ['SYNCHRONIZATION_PENDING', 'ASSESSMENT_PENDING', 'ASSESSMENT_CURRENT'],
  })
  lifecyclePhase: SupplierSyncAssessmentLifecyclePhase;

  @ApiProperty({
    description: 'True when a new sync snapshot exists that has not been assessed',
  })
  canRunAssessment: boolean;

  @ApiPropertyOptional({ type: SupplierSyncSnapshotDto })
  latestSyncRun: SupplierSyncSnapshotDto | null;

  @ApiPropertyOptional({ type: SupplierLastAssessmentDto })
  lastAssessment: SupplierLastAssessmentDto | null;

  @ApiPropertyOptional({
    description:
      'Sync snapshot that reconciliation findings on this page reflect (last completed assessment)',
  })
  findingsSnapshotRef: string | null;
}
