import { ApiProperty } from '@nestjs/swagger';

export type WorkforceSnapshotAssessmentLabel = 'Pending' | 'Assessed' | 'Not assessed';

export class WorkforceDiscoverySnapshotHistoryItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'DISC-00001' })
  snapshotRef: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty({ example: 'Oracle HCM' })
  source: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  workersDiscovered: number;

  @ApiProperty()
  newWorkers: number;

  @ApiProperty()
  updatedWorkers: number;

  @ApiProperty()
  unchangedWorkers: number;

  @ApiProperty()
  failedWorkers: number;

  @ApiProperty({
    description: 'Records that could not be matched during discovery (not governance resolution)',
  })
  discoveryExceptions: number;

  @ApiProperty({ enum: ['Pending', 'Assessed', 'Not assessed'] })
  assessmentLabel: WorkforceSnapshotAssessmentLabel;

  @ApiProperty()
  isLatest: boolean;
}
