export type ResolutionType =
  | 'MANAGER'
  | 'SKIP_LEVEL_MANAGER'
  | 'ORG_UNIT_FALLBACK'
  | 'ROLE_FALLBACK';

export type AttemptStatus = 'RESOLVED' | 'FAILED' | 'SKIPPED' | 'NOT_USED';
export type RouteStatus = 'RESOLVED' | 'RESOLVED_WITH_FALLBACK' | 'UNRESOLVED';

export type RouteStep = {
  level: number;
  resolution_type: ResolutionType;
  approver_user_id: string;
  approver_employee_id?: string;
  approver_name: string;
  reason_code: string;
  reason: string;
};

export type RouteAttempt = {
  resolution_type: ResolutionType;
  status: AttemptStatus;
  reason_code: string;
  reason: string;
};

export type RouteResolutionResult = {
  status: RouteStatus;
  policy: string;
  requester: {
    employee_id: string;
    employee_no?: string;
    full_name: string;
    legal_entity_id?: string;
    org_unit_id?: string;
  };
  steps: RouteStep[];
  attempts: RouteAttempt[];
  meta: {
    fallback_used: boolean;
    resolved_steps: number;
    generated_at: string;
  };
};

export type RoutingContext = {
  requesterEmployeeId: string;
  requestType: string;
  routingPolicy: string;
  legalEntityId?: string;
  orgUnitId?: string;
  roleFallback?: string;
};

export const REASON_CODES = {
  DIRECT_MANAGER_ACTIVE_AND_ELIGIBLE: 'Direct manager active and eligible',
  SKIP_LEVEL_MANAGER_ELIGIBLE: 'Skip-level manager active and eligible',
  ORG_UNIT_MANAGER_FOUND: 'Org-unit manager found and eligible',
  ROLE_FALLBACK_REQUIRED_BY_POLICY: 'Role fallback required by policy',
  SCOPED_ROLE_HOLDER_FOUND: 'Role fallback resolved within legal-entity scope',
  GLOBAL_ROLE_HOLDER_FOUND: 'Role fallback resolved with global role holder',

  NO_MANAGER_ASSIGNED: 'No manager assigned',
  MANAGER_HAS_NO_LINKED_USER: 'Manager employee has no linked platform user',
  MANAGER_USER_INACTIVE: 'Manager user account is inactive',
  SELF_APPROVAL_NOT_ALLOWED: 'Self-approval not allowed',
  NO_SKIP_LEVEL_AVAILABLE: 'No skip-level manager available',
  NO_ORG_UNIT_MANAGER_FOUND: 'No org-unit fallback approver found',
  NO_ELIGIBLE_ROLE_HOLDER_IN_SCOPE: 'No eligible role holder found in scope',
  REQUESTER_EMPLOYEE_NOT_FOUND: 'Requester employee not found',
  REQUESTER_HAS_NO_CURRENT_EMPLOYMENT: 'Requester has no current employment',

  POLICY_ALREADY_RESOLVED: 'Policy already resolved before this step',
  STEP_NOT_REQUIRED_BY_POLICY: 'Step not required by this policy',
} as const;
