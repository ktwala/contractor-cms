import { ResolutionType } from './approval-routing.types';

export const ROUTING_POLICIES: Record<string, ResolutionType[]> = {
  MANAGER_ONLY: ['MANAGER'],
  MANAGER_SKIP: ['MANAGER', 'SKIP_LEVEL_MANAGER'],
  MANAGER_ORG_ROLE: ['MANAGER', 'ORG_UNIT_FALLBACK', 'ROLE_FALLBACK'],
  MANAGER_SKIP_ORG_ROLE: ['MANAGER', 'SKIP_LEVEL_MANAGER', 'ORG_UNIT_FALLBACK', 'ROLE_FALLBACK'],
};

export const POLICY_LABELS: Record<string, string> = {
  MANAGER_ONLY: 'Manager Only',
  MANAGER_SKIP: 'Manager → Skip-level',
  MANAGER_ORG_ROLE: 'Manager → Org Fallback → Role',
  MANAGER_SKIP_ORG_ROLE: 'Manager → Skip-level → Org Fallback → Role',
};

export const REQUEST_TYPES = [
  { code: 'ACCESS_REQUEST', label: 'Access Request' },
  { code: 'PROFILE_CHANGE', label: 'Employee Profile Change' },
  { code: 'PAYROLL_ADJUSTMENT', label: 'Payroll Adjustment' },
  { code: 'MANAGER_CERTIFICATION', label: 'Manager Certification' },
] as const;

export const FALLBACK_ROLES = [
  { code: 'HR_ADMIN', label: 'HR Admin' },
  { code: 'PAYROLL_APPROVER', label: 'Payroll Approver' },
  { code: 'FINANCE_APPROVER', label: 'Finance Approver' },
] as const;

export function getRequiredApprovalCapability(requestType: string): string | null {
  switch (requestType) {
    case 'ACCESS_REQUEST':
      return 'INTEGRATION_IGA';
    case 'PROFILE_CHANGE':
      return 'HR_ADMIN';
    case 'PAYROLL_ADJUSTMENT':
      return 'PAYROLL_APPROVER';
    case 'MANAGER_CERTIFICATION':
      return 'HR_ADMIN';
    default:
      return null;
  }
}
