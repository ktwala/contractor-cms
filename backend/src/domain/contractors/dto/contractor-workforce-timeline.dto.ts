import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ContractorWorkforceHistorySource,
  ContractorWorkforceState,
} from '@prisma/client';

export class WorkforceHistoryEntryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  contractorId: string;

  @ApiPropertyOptional()
  organizationId?: string | null;

  @ApiPropertyOptional({ enum: ContractorWorkforceState, enumName: 'ContractorWorkforceState' })
  fromState?: ContractorWorkforceState | null;

  @ApiProperty({ enum: ContractorWorkforceState, enumName: 'ContractorWorkforceState' })
  toState: ContractorWorkforceState;

  @ApiProperty({
    description: 'Derived from fromState→toState (not stored as eventType)',
  })
  transitionLabel: string;

  @ApiProperty()
  occurredAt: Date;

  @ApiPropertyOptional()
  effectiveAt?: Date | null;

  @ApiPropertyOptional()
  actorUserId?: string | null;

  @ApiPropertyOptional()
  reason?: string | null;

  @ApiProperty({ enum: ContractorWorkforceHistorySource, enumName: 'ContractorWorkforceHistorySource' })
  source: ContractorWorkforceHistorySource;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  metadata?: Record<string, unknown> | null;
}

export class ContractorWorkforceTimelineResponseDto {
  @ApiProperty({ type: [WorkforceHistoryEntryDto] })
  data: WorkforceHistoryEntryDto[];
}
