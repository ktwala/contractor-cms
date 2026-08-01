import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ContractorWorkforceState,
  EngagementModel,
  WorkerClassification,
} from '@prisma/client';

export class ContractorPlacementIntentDto {
  @ApiProperty()
  engagementId: string;

  @ApiProperty()
  role: string;

  @ApiProperty()
  startDate: Date;

  @ApiPropertyOptional()
  endDate?: Date | null;

  @ApiProperty()
  rateType: string;

  @ApiProperty()
  rateAmount: string;

  @ApiProperty()
  currency: string;

  @ApiPropertyOptional()
  responsibleManagerEmployeeId?: string | null;

  @ApiPropertyOptional()
  contractId?: string;

  @ApiPropertyOptional()
  contractNumber?: string;

  @ApiPropertyOptional()
  contractTitle?: string;
}

export class ContractorWorkforceReviewQueueItemDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional({ nullable: true })
  supplierId?: string | null;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ enum: WorkerClassification })
  workerClassification: WorkerClassification;

  @ApiProperty({ enum: EngagementModel })
  engagementModel: EngagementModel;

  @ApiProperty({ enum: ContractorWorkforceState, enumName: 'ContractorWorkforceState' })
  workforceState: ContractorWorkforceState;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  supplierDisplayName: string;

  @ApiPropertyOptional({ type: ContractorPlacementIntentDto })
  placementIntent?: ContractorPlacementIntentDto | null;

  @ApiProperty({
    description: 'NOMINATED → PENDING_APPROVAL when actor holds contractors:update',
  })
  canSubmitForReview: boolean;

  @ApiProperty({
    description: 'PENDING_APPROVAL → ACTIVE when actor holds contractors:update',
  })
  canActivate: boolean;

  @ApiProperty({
    description: 'NOMINATED | PENDING_APPROVAL → REJECTED when actor holds contractors:update',
  })
  canReject: boolean;

  @ApiProperty({
    description: 'PENDING_APPROVAL → NOMINATED (return to supplier) when actor holds contractors:update',
  })
  canSendBack: boolean;

  @ApiProperty({
    description: 'Ops policy block → BLACKLISTED when actor holds contractors:update',
  })
  canBlacklist: boolean;

  @ApiPropertyOptional({
    description: 'REJECTED → NOMINATED reopen (registry panel only)',
  })
  canReopen?: boolean;

  @ApiPropertyOptional({
    enum: ContractorWorkforceState,
    enumName: 'ContractorWorkforceState',
    description: 'Next workforce state for the primary ops action',
  })
  nextTargetState?: ContractorWorkforceState | null;
}

export class ContractorWorkforceReviewQueueResponseDto {
  @ApiProperty({ type: [ContractorWorkforceReviewQueueItemDto] })
  data: ContractorWorkforceReviewQueueItemDto[];

  @ApiProperty()
  total: number;
}
