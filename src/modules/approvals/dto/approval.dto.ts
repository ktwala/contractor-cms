import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  IsArray,
  ValidateNested,
  IsUUID,
  IsDateString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ApprovalEntityType {
  PAYRUN = 'PAYRUN',
  CHANGE_REQUEST = 'CHANGE_REQUEST',
  EMPLOYEE_CHANGE = 'EMPLOYEE_CHANGE',
}

export enum ApprovalStepStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SKIPPED = 'SKIPPED',
  DELEGATED = 'DELEGATED',
}

// ============================================================================
// Workflow DTOs
// ============================================================================

export class CreateApprovalLevelDto {
  @ApiProperty({ example: 1, description: 'Order of this level (1 = first approver)' })
  @IsInt()
  @Min(1)
  level_order: number;

  @ApiProperty({ example: 'Manager Approval' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Department manager must approve' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Specific user ID who approves at this level' })
  @IsOptional()
  @IsUUID()
  approver_user_id?: string;

  @ApiPropertyOptional({ description: 'Role ID - any user with this role can approve' })
  @IsOptional()
  @IsUUID()
  approver_role_id?: string;

  @ApiPropertyOptional({ default: true, description: 'Can this level be delegated' })
  @IsOptional()
  @IsBoolean()
  can_delegate?: boolean;

  @ApiPropertyOptional({ description: 'Auto-approve after X hours (null = never)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  auto_approve_after_hours?: number;
}

export class CreateWorkflowDto {
  @ApiProperty({ example: 'Payroll 3-Level Approval' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Standard approval flow for monthly payroll' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ApprovalEntityType })
  @IsEnum(ApprovalEntityType)
  entity_type: ApprovalEntityType;

  @ApiPropertyOptional({ description: 'Legal entity ID (null = global)' })
  @IsOptional()
  @IsUUID()
  legal_entity_id?: string;

  @ApiPropertyOptional({ description: 'Pay group ID (null = all pay groups)' })
  @IsOptional()
  @IsUUID()
  pay_group_id?: string;

  @ApiProperty({ type: [CreateApprovalLevelDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateApprovalLevelDto)
  levels: CreateApprovalLevelDto[];
}

export class UpdateWorkflowDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

// ============================================================================
// Approval Action DTOs
// ============================================================================

export class SubmitForApprovalDto {
  @ApiProperty({ description: 'Entity ID (e.g., PayRun ID)' })
  @IsUUID()
  entity_id: string;

  @ApiProperty({ enum: ApprovalEntityType })
  @IsEnum(ApprovalEntityType)
  entity_type: ApprovalEntityType;

  @ApiPropertyOptional({ description: 'Note for approvers' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class ApproveStepDto {
  @ApiPropertyOptional({ description: 'Approval comment' })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class RejectStepDto {
  @ApiProperty({ description: 'Rejection reason (required)' })
  @IsString()
  @IsNotEmpty()
  comment: string;
}

export class DelegateStepDto {
  @ApiProperty({ description: 'User ID to delegate to' })
  @IsUUID()
  delegate_to: string;

  @ApiPropertyOptional({ description: 'Delegation note' })
  @IsOptional()
  @IsString()
  note?: string;
}

// ============================================================================
// Delegation DTOs
// ============================================================================

export class CreateDelegationDto {
  @ApiProperty({ description: 'User ID to delegate to' })
  @IsUUID()
  delegate_id: string;

  @ApiProperty({ example: '2025-12-20', description: 'Start date of delegation' })
  @IsDateString()
  start_date: string;

  @ApiProperty({ example: '2025-12-31', description: 'End date of delegation' })
  @IsDateString()
  end_date: string;

  @ApiPropertyOptional({ example: 'On annual leave' })
  @IsOptional()
  @IsString()
  reason?: string;
}

// ============================================================================
// Response DTOs
// ============================================================================

export class ApprovalLevelResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  level_order: number;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  approver_user_id?: string;

  @ApiPropertyOptional()
  approver_role_id?: string;

  @ApiProperty()
  can_delegate: boolean;

  @ApiPropertyOptional()
  auto_approve_after_hours?: number;
}

export class WorkflowResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ enum: ApprovalEntityType })
  entity_type: ApprovalEntityType;

  @ApiPropertyOptional()
  legal_entity_id?: string;

  @ApiPropertyOptional()
  pay_group_id?: string;

  @ApiProperty()
  is_active: boolean;

  @ApiProperty({ type: [ApprovalLevelResponseDto] })
  levels: ApprovalLevelResponseDto[];

  @ApiProperty()
  created_at: string;
}

export class ApprovalStepResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  level_order: number;

  @ApiProperty()
  level_name: string;

  @ApiProperty({ enum: ApprovalStepStatus })
  status: ApprovalStepStatus;

  @ApiProperty()
  assigned_to: string;

  @ApiPropertyOptional()
  assigned_to_name?: string;

  @ApiPropertyOptional()
  delegated_to?: string;

  @ApiPropertyOptional()
  delegated_to_name?: string;

  @ApiPropertyOptional()
  acted_by?: string;

  @ApiPropertyOptional()
  acted_by_name?: string;

  @ApiPropertyOptional()
  acted_at?: string;

  @ApiPropertyOptional()
  comment?: string;

  @ApiProperty()
  created_at: string;
}

export class ApprovalInstanceResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  workflow_id: string;

  @ApiProperty()
  workflow_name: string;

  @ApiProperty({ enum: ApprovalEntityType })
  entity_type: ApprovalEntityType;

  @ApiProperty()
  entity_id: string;

  @ApiProperty()
  current_level: number;

  @ApiProperty()
  total_levels: number;

  @ApiProperty()
  is_complete: boolean;

  @ApiProperty()
  is_cancelled: boolean;

  @ApiProperty()
  submitted_by: string;

  @ApiPropertyOptional()
  submitted_by_name?: string;

  @ApiProperty()
  submitted_at: string;

  @ApiPropertyOptional()
  completed_at?: string;

  @ApiProperty({ type: [ApprovalStepResponseDto] })
  steps: ApprovalStepResponseDto[];
}

export class PendingApprovalResponseDto {
  @ApiProperty()
  step_id: string;

  @ApiProperty()
  instance_id: string;

  @ApiProperty({ enum: ApprovalEntityType })
  entity_type: ApprovalEntityType;

  @ApiProperty()
  entity_id: string;

  @ApiPropertyOptional({ description: 'Entity summary (e.g., PayRun period)' })
  entity_summary?: string;

  @ApiProperty()
  level_name: string;

  @ApiProperty()
  level_order: number;

  @ApiProperty()
  submitted_by: string;

  @ApiProperty()
  submitted_at: string;

  @ApiPropertyOptional()
  can_delegate: boolean;

  @ApiPropertyOptional()
  is_delegated: boolean;
}
