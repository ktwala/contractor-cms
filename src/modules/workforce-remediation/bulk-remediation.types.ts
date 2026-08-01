export type BulkRemediationType =
  | 'BULK_ASSIGN_MANAGER'
  | 'BULK_ASSIGN_ORG_UNIT'
  | 'BULK_ASSIGN_COST_CENTER'
  | 'BULK_CREATE_ASSIGNMENTS'
  | 'BULK_CREATE_EMPLOYMENTS';

export const ISSUE_TO_REMEDIATION: Record<string, BulkRemediationType> = {
  MISSING_MANAGER: 'BULK_ASSIGN_MANAGER',
  MISSING_ORG_ASSIGNMENT: 'BULK_ASSIGN_ORG_UNIT',
  MISSING_COST_CENTER: 'BULK_ASSIGN_COST_CENTER',
  EMPLOYEE_WITHOUT_ASSIGNMENT: 'BULK_CREATE_ASSIGNMENTS',
  EMPLOYEE_WITHOUT_EMPLOYMENT: 'BULK_CREATE_EMPLOYMENTS',
};

export interface BulkRemediationPreviewRequest {
  issueType: string;
  filters?: {
    legalEntityId?: string;
    orgUnitId?: string;
  };
  proposedFix: Record<string, unknown>;
}

export interface AffectedEmployee {
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  orgUnitName?: string;
  legalEntityName?: string;
}

export interface BulkRemediationPreview {
  recordsAffected: number;
  employees: AffectedEmployee[];
  changesPreview: {
    field: string;
    label: string;
    oldValue: unknown;
    newValue: unknown;
    newValueLabel?: string;
  };
  expectedImpact: {
    issuesResolved: number;
    exportBlockersReduced: number;
    readinessDeltaEstimate: string;
  };
}

export interface BulkRemediationApplyRequest {
  issueType: string;
  filters?: {
    legalEntityId?: string;
    orgUnitId?: string;
  };
  fix: Record<string, unknown>;
}

export interface BulkRemediationResult {
  success: boolean;
  recordsUpdated: number;
  affectedScopes: {
    legalEntityIds: string[];
    orgUnitIds: string[];
  };
  auditLogId?: string;
}
