/**
 * Canonical remediation routing table.
 * Maps issue types to destination pages and human-readable labels.
 */
export const REMEDIATION_ROUTES: Record<string, { path: string; label: string }> = {
  MISSING_MANAGER: { path: '/enterprise/manager-hierarchy', label: 'Open Manager Hierarchy' },
  MISSING_ORG_ASSIGNMENT: { path: '/enterprise/employment-assignments', label: 'Open Assignments' },
  MISSING_COST_CENTER: { path: '/enterprise/employment-assignments', label: 'Open Assignments' },
  MISSING_LEGAL_ENTITY: { path: '/enterprise/employments', label: 'Open Employments' },
  EMPLOYEE_WITHOUT_EMPLOYMENT: { path: '/enterprise/employments', label: 'Create Employment' },
  EMPLOYEE_WITHOUT_ASSIGNMENT: { path: '/enterprise/employment-assignments', label: 'Create Assignment' },
  EMPLOYEE_EXPORT_BLOCKED: { path: '/enterprise/hr-export', label: 'View Export Blockers' },
  ORG_UNIT_WITHOUT_MANAGER: { path: '/enterprise/org-structure', label: 'Open Org Structure' },
  ORG_UNIT_WITHOUT_EMPLOYEES: { path: '/enterprise/org-structure', label: 'Open Org Structure' },
  COST_CENTER_UNUSED: { path: '/enterprise/cost-centers', label: 'Review Cost Centers' },
};

export function getRemediationRoute(issueType: string, params?: Record<string, string>): string {
  const route = REMEDIATION_ROUTES[issueType];
  if (!route) return '#';
  const qp = new URLSearchParams({ issueType, ...(params || {}) });
  return `${route.path}?${qp.toString()}`;
}

export function getRemediationLabel(issueType: string): string {
  return REMEDIATION_ROUTES[issueType]?.label || 'View details';
}

export const ISSUE_TYPE_LABELS: Record<string, string> = {
  MISSING_MANAGER: 'Missing manager',
  MISSING_ORG_ASSIGNMENT: 'Missing org assignment',
  MISSING_COST_CENTER: 'Missing cost center',
  MISSING_LEGAL_ENTITY: 'Missing legal entity',
  EMPLOYEE_WITHOUT_EMPLOYMENT: 'No active employment',
  EMPLOYEE_WITHOUT_ASSIGNMENT: 'No active assignment',
  EMPLOYEE_EXPORT_BLOCKED: 'Export blocked',
  ORG_UNIT_WITHOUT_MANAGER: 'Org unit without manager',
  ORG_UNIT_WITHOUT_EMPLOYEES: 'Org unit without employees',
  COST_CENTER_UNUSED: 'Cost center unused',
  MISSING_PAY_GROUP: 'Missing pay group',
  MISSING_HIRE_DATE: 'Missing hire date',
  MANAGER_CHAIN_INCOMPLETE: 'Manager chain incomplete',
  MANAGER_SELF_REFERENCE: 'Manager self-reference',
  HIERARCHY_CYCLE_RISK: 'Hierarchy cycle risk',
};
