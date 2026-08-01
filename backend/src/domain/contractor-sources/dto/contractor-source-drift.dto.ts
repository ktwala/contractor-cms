import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ContractorSourceDriftSeverity,
  ContractorSourceDriftStatus,
  ContractorSourceDriftType,
  GovernanceOperationalImpact,
  GovernanceSignalCategory,
  GovernanceSignalOwner,
  MigrationSourceSystem,
  SignalLifecycleState,
} from '@prisma/client';
import { Type, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class QueryContractorSourceDriftDto {
  @ApiPropertyOptional({ enum: ContractorSourceDriftStatus })
  @IsOptional()
  @IsEnum(ContractorSourceDriftStatus)
  status?: ContractorSourceDriftStatus;

  @ApiPropertyOptional({ enum: ContractorSourceDriftSeverity })
  @IsOptional()
  @IsEnum(ContractorSourceDriftSeverity)
  severity?: ContractorSourceDriftSeverity;

  @ApiPropertyOptional({ enum: ContractorSourceDriftType })
  @IsOptional()
  @IsEnum(ContractorSourceDriftType)
  driftType?: ContractorSourceDriftType;

  @ApiPropertyOptional({
    description:
      'When true (default), hides bootstrap signals suppressed after workforce cutover',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return true;
    return value === true || value === 'true';
  })
  @IsBoolean()
  operationalOnly?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class AssignContractorSourceDriftDto {
  @ApiProperty()
  @IsUUID()
  assignedToUserId: string;
}

export class ResolveContractorSourceDriftDto {
  @ApiProperty()
  @IsString()
  resolutionNotes: string;
}

export class ContractorSourceDriftItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  organizationId: string;

  @ApiPropertyOptional()
  contractorId: string | null;

  @ApiPropertyOptional()
  stagingId: string | null;

  @ApiProperty({ enum: MigrationSourceSystem })
  sourceSystem: MigrationSourceSystem;

  @ApiPropertyOptional()
  sourcePersonId: string | null;

  @ApiProperty({ enum: ContractorSourceDriftType })
  driftType: ContractorSourceDriftType;

  @ApiProperty({ enum: ContractorSourceDriftSeverity })
  severity: ContractorSourceDriftSeverity;

  @ApiProperty({ enum: ContractorSourceDriftStatus })
  status: ContractorSourceDriftStatus;

  @ApiProperty({ enum: GovernanceSignalCategory })
  signalCategory: GovernanceSignalCategory;

  @ApiProperty({ enum: GovernanceSignalCategory })
  detectedPhase: GovernanceSignalCategory;

  @ApiPropertyOptional()
  expiresAt: string | null;

  @ApiProperty()
  suppressAfterCutover: boolean;

  @ApiProperty()
  lineageOnly: boolean;

  @ApiProperty({ enum: GovernanceOperationalImpact })
  operationalImpact: GovernanceOperationalImpact;

  @ApiProperty({ enum: GovernanceSignalOwner })
  governanceOwner: GovernanceSignalOwner;

  @ApiProperty()
  detectedAt: string;

  @ApiPropertyOptional()
  classifiedAt: string | null;

  @ApiPropertyOptional()
  reviewedAt: string | null;

  @ApiPropertyOptional()
  resolvedAt: string | null;

  @ApiPropertyOptional()
  detectedByRunId: string | null;

  @ApiPropertyOptional()
  resolutionNotes: string | null;

  @ApiPropertyOptional()
  assignedToUserId: string | null;

  @ApiPropertyOptional()
  ageHours?: number;

  // PR-GOV-SIGNAL-LIFECYCLE-3 — temporal decay fields
  @ApiProperty({ enum: SignalLifecycleState })
  signalLifecycleState: SignalLifecycleState;

  @ApiPropertyOptional()
  decayStartedAt: string | null;

  @ApiPropertyOptional()
  archivedAt: string | null;

  @ApiPropertyOptional()
  archivedReason: string | null;

  @ApiPropertyOptional()
  retentionUntil: string | null;
}

export class PaginatedContractorSourceDriftResponseDto {
  @ApiProperty({ type: [ContractorSourceDriftItemDto] })
  data: ContractorSourceDriftItemDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}

export class ContractorSourceDriftSummaryDto {
  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  critical: number;

  @ApiProperty()
  high: number;

  @ApiProperty()
  medium: number;

  @ApiProperty()
  low: number;

  @ApiProperty()
  underReview: number;

  @ApiProperty()
  openTotal: number;

  @ApiProperty({
    description: 'Critical open drifts older than 24h (workforce governance)',
  })
  criticalUnresolvedOver24h: number;

  @ApiProperty()
  lifecycleConflictOpen: number;

  @ApiProperty({
    description: 'Active CMS contractors without sponsor assignment (operational governance)',
  })
  missingResponsibleManagerOpen: number;

  @ApiProperty()
  identityConflictOpen: number;

  @ApiProperty()
  supplierLinkMissingOpen: number;

  @ApiProperty()
  evaluatedAt: string;
}

export class DetectContractorSourceDriftResponseDto {
  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  detected: number;

  @ApiProperty()
  updated: number;

  @ApiPropertyOptional()
  remediationsCreated?: number;

  @ApiProperty()
  evaluatedAt: string;

  @ApiPropertyOptional({
    example: 'DISC-00015',
    description: 'Discovery snapshot assessed by this run',
  })
  discoverySnapshotRef?: string;
}

// ---------------------------------------------------------------------------
// PR-GOV-SIGNAL-LIFECYCLE-2 — Workforce cutover ceremony
// ---------------------------------------------------------------------------

export type GovernancePhase = 'NO_CUTOVER' | 'PRE_CUTOVER' | 'POST_CUTOVER';

export class SetWorkforceCutoverDto {
  @ApiPropertyOptional({
    description:
      'ISO-8601 cutover timestamp, or null to clear. ' +
      'Setting this declares the authority transition from HCM bootstrap to CMS operational governance.',
    nullable: true,
    example: '2026-06-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  cutoverAt: string | null;
}

export class WorkforceCutoverResponseDto {
  @ApiProperty({ nullable: true })
  workforceMigrationCutoverAt: string | null;

  @ApiProperty()
  updatedAt: string;

  @ApiProperty({
    enum: ['NO_CUTOVER', 'PRE_CUTOVER', 'POST_CUTOVER'],
    description:
      'Governance phase derived server-side. ' +
      'NO_CUTOVER = bootstrap lineage visible; ' +
      'PRE_CUTOVER = cutover declared but not yet reached; ' +
      'POST_CUTOVER = cutover passed, operational governance prioritized.',
  })
  governancePhase: GovernancePhase;
}

// ---------------------------------------------------------------------------
// PR-GOV-SIGNAL-LIFECYCLE-3 — Bootstrap decay summary
// ---------------------------------------------------------------------------

export class BootstrapDecaySummaryDto {
  @ApiProperty()
  organizationId: string;

  @ApiProperty({ enum: ['NO_CUTOVER', 'PRE_CUTOVER', 'POST_CUTOVER'] })
  governancePhase: GovernancePhase;

  @ApiProperty({
    description: 'BOOTSTRAP signals transitioned from ACTIVE → DECAYING in this run.',
  })
  activatedToDecaying: number;

  @ApiProperty({
    description: 'BOOTSTRAP signals transitioned from DECAYING → ARCHIVED in this run.',
  })
  decayingToArchived: number;

  @ApiProperty({ description: 'Total BOOTSTRAP signals now in ARCHIVED state for this org.' })
  totalArchived: number;

  @ApiPropertyOptional({
    description: 'ISO timestamp of the archive threshold (cutoverAt + grace period).',
    nullable: true,
  })
  decayThreshold: string | null;

  @ApiProperty()
  evaluatedAt: string;
}
