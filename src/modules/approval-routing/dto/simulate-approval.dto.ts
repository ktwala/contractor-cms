import { IsIn, IsOptional, IsString } from 'class-validator';

export class SimulateApprovalDto {
  @IsString()
  requester_employee_id!: string;

  @IsString()
  @IsIn([
    'ACCESS_REQUEST',
    'PROFILE_CHANGE',
    'PAYROLL_ADJUSTMENT',
    'MANAGER_CERTIFICATION',
  ])
  request_type!: string;

  @IsString()
  @IsIn([
    'MANAGER_ONLY',
    'MANAGER_SKIP',
    'MANAGER_ORG_ROLE',
    'MANAGER_SKIP_ORG_ROLE',
  ])
  routing_policy!: string;

  @IsOptional()
  @IsString()
  legal_entity_id?: string;

  @IsOptional()
  @IsString()
  org_unit_id?: string;

  @IsOptional()
  @IsString()
  role_fallback?: string;
}
