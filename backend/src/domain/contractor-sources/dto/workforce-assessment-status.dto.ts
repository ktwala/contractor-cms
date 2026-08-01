import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type WorkforceAssessmentLifecyclePhase =
  | 'DISCOVERY_PENDING'
  | 'ASSESSMENT_PENDING'
  | 'ASSESSMENT_CURRENT';

export class WorkforceDiscoverySnapshotDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'DISC-00015' })
  snapshotRef: string;

  @ApiProperty()
  importedCount: number;

  @ApiProperty()
  finishedAt: string;
}

export class WorkforceLastAssessmentDto {
  @ApiProperty()
  discoveryRunId: string;

  @ApiProperty({ example: 'DISC-00015' })
  snapshotRef: string;

  @ApiProperty()
  assessedAt: string;
}

export class WorkforceAssessmentStatusDto {
  @ApiProperty({
    enum: ['DISCOVERY_PENDING', 'ASSESSMENT_PENDING', 'ASSESSMENT_CURRENT'],
  })
  lifecyclePhase: WorkforceAssessmentLifecyclePhase;

  @ApiProperty({
    description: 'True when a new discovery snapshot exists that has not been assessed',
  })
  canRunAssessment: boolean;

  @ApiPropertyOptional({ type: WorkforceDiscoverySnapshotDto })
  latestDiscoveryRun: WorkforceDiscoverySnapshotDto | null;

  @ApiPropertyOptional({ type: WorkforceLastAssessmentDto })
  lastAssessment: WorkforceLastAssessmentDto | null;

  @ApiPropertyOptional({
    description:
      'Discovery snapshot that assessment findings on this page reflect (last completed assessment)',
  })
  findingsSnapshotRef: string | null;
}
