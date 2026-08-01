import { ApiProperty } from '@nestjs/swagger';
import { SupplierResponseDto } from './supplier-response.dto';

export type SupplierEvidenceSummaryStatus = 'COMPLETE' | 'INCOMPLETE' | 'EXPIRED';

export class SupplierApprovalQueueItemDto extends SupplierResponseDto {
  @ApiProperty({ enum: ['COMPLETE', 'INCOMPLETE', 'EXPIRED'] })
  evidenceStatus: SupplierEvidenceSummaryStatus;

  @ApiProperty()
  evidenceComplete: boolean;

  @ApiProperty()
  missingCount: number;

  @ApiProperty()
  expiredCount: number;

  @ApiProperty({
    description: 'False when actor is supplier-scoped to this supplier (self-approval blocked)',
  })
  canApprove: boolean;

  @ApiProperty({ description: 'Governance jurisdiction (ISO 3166-1 alpha-2)' })
  jurisdictionCode: string;

  @ApiProperty({
    description: 'Why this supplier is awaiting approval — operator-facing business reason',
  })
  waitingFor: string;

  @ApiProperty({
    required: false,
    description: 'Clarifies inherited Oracle procurement evidence when CMS catalog is incomplete',
  })
  evidenceNote?: string;
}

export class SupplierApprovalQueueResponseDto {
  @ApiProperty({ type: [SupplierApprovalQueueItemDto] })
  data: SupplierApprovalQueueItemDto[];

  @ApiProperty()
  total: number;
}
