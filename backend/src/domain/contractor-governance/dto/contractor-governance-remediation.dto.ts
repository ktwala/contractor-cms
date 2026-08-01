import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ContractorGovernanceRemediationStatus,
  ContractorGovernanceRemediationType,
  ContractorSourceDriftSeverity,
} from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { WORKFORCE_TELEMETRY_POPULATION_SCOPES } from '../../contractor-sources/workforce-telemetry-population.constants';

export class PolicyEvaluationStepDto {
  @ApiProperty({
    description: 'Authoritative governance capability evaluated',
    example: 'Workforce Governance',
  })
  capability: string;

  @ApiProperty({ enum: ['PASS', 'FAIL'] })
  status: 'PASS' | 'FAIL';

  @ApiPropertyOptional({
    description: 'Governance finding when status is FAIL — owned by the capability',
    example: 'No Responsible Manager assigned',
  })
  finding?: string;
}

export class CreateContractorGovernanceRemediationDto {
  @ApiProperty()
  @IsUUID()
  driftId: string;

  @ApiPropertyOptional({ enum: ContractorGovernanceRemediationType })
  @IsOptional()
  @IsEnum(ContractorGovernanceRemediationType)
  remediationType?: ContractorGovernanceRemediationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;
}

export class AssignContractorGovernanceRemediationDto {
  @ApiProperty()
  @IsUUID()
  assignedToUserId: string;
}

export class VerifyContractorGovernanceRemediationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CloseContractorGovernanceRemediationDto {
  @ApiProperty()
  @IsString()
  resolutionNotes: string;
}

export class QueryContractorGovernanceRemediationDto {
  @ApiPropertyOptional({ enum: ContractorGovernanceRemediationStatus })
  @IsOptional()
  @IsEnum(ContractorGovernanceRemediationStatus)
  status?: ContractorGovernanceRemediationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class ContractorGovernanceRemediationItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  driftId: string;

  @ApiPropertyOptional()
  contractorId: string | null;

  @ApiProperty({ enum: ContractorGovernanceRemediationType })
  remediationType: ContractorGovernanceRemediationType;

  @ApiProperty({ description: 'Operator-facing label (operational governance, not IGA)' })
  remediationTypeLabel: string;

  @ApiProperty({ enum: ContractorGovernanceRemediationStatus })
  remediationStatus: ContractorGovernanceRemediationStatus;

  @ApiPropertyOptional()
  assignedToUserId: string | null;

  @ApiPropertyOptional()
  dueAt: string | null;

  @ApiProperty()
  escalationLevel: number;

  @ApiProperty()
  pdpRestrictionsApplied: boolean;

  @ApiPropertyOptional()
  driftType?: string;

  @ApiPropertyOptional()
  driftTypeLabel?: string;

  @ApiPropertyOptional({ enum: ContractorSourceDriftSeverity })
  driftSeverity?: ContractorSourceDriftSeverity;

  @ApiPropertyOptional()
  verifiedAt: string | null;

  @ApiPropertyOptional()
  closedAt: string | null;

  @ApiProperty()
  createdAt: string;

  @ApiPropertyOptional()
  ageHours?: number;

  @ApiPropertyOptional()
  isOverdue?: boolean;

  @ApiPropertyOptional({
    description: 'Policy Evaluation outcome when pdpRestrictionsApplied — decision only, not the owned fact',
    example: 'Restricted',
  })
  policyDecision?: string;

  @ApiPropertyOptional({
    description: 'Governance finding that Policy Evaluation read (owned elsewhere)',
    example: 'No Responsible Manager assigned',
  })
  policyEvaluationReason?: string;

  @ApiPropertyOptional({
    description: 'Authoritative capability that owns the evaluated fact',
    example: 'Workforce Governance',
  })
  policySourceTruth?: string;

  @ApiPropertyOptional({
    description: 'Recommended resolution under the owning capability — not a policy-owned action',
    example: 'Assign a Responsible Manager',
  })
  policyResolutionAction?: string;

  @ApiPropertyOptional({
    type: [PolicyEvaluationStepDto],
    description:
      'Ordered evaluation chain — which authoritative capabilities passed or failed before the decision',
  })
  policyEvaluationSteps?: PolicyEvaluationStepDto[];
}

export class PaginatedContractorGovernanceRemediationDto {
  @ApiProperty({ type: [ContractorGovernanceRemediationItemDto] })
  data: ContractorGovernanceRemediationItemDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}

export class ContractorGovernanceRemediationSummaryDto {
  @ApiProperty()
  organizationId: string;

  @ApiProperty({
    description: 'Human-readable population — open task records, not worker headcount',
    example: WORKFORCE_TELEMETRY_POPULATION_SCOPES.workforceResolutionTasks,
  })
  populationScope: string;

  @ApiProperty({
    description:
      'Open workforce resolution task records (may exceed unique workers; Supplier Governance trust decisions are excluded)',
  })
  activeRemediations: number;

  @ApiProperty()
  criticalUnresolved: number;

  @ApiProperty({
    description:
      'Open workforce resolution tasks where Policy Evaluation applied a restrict decision',
  })
  pdpRestrictionsActive: number;

  @ApiProperty()
  escalationsOverdue: number;

  @ApiProperty({
    description: 'Open remediations for MISSING_RESPONSIBLE_MANAGER (flagship operational governance)',
  })
  missingResponsibleManagerGovernanceOpen: number;

  @ApiProperty()
  evaluatedAt: string;
}
