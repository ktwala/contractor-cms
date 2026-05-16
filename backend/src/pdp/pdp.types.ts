import { PdpReasonCode } from './pdp.reason-codes';

export type PdpAction = 'SUBMIT_TIMESHEET' | 'SUBMIT_INVOICE';

export interface PdpContext {
  organizationId?: string; // Tenant context
  supplierId: string;
  contractorId?: string;
  poId?: string;
  timesheetId?: string;
  invoiceId?: string;
  transactionDate: Date;
  metadata?: Record<string, any>;
}

export type PdpDecisionType = 'ALLOW' | 'WARN' | 'APPROVAL_REQUIRED' | 'HOLD' | 'BLOCK';

export type PdpReversibility = 
  | 'REVERSIBLE_AFTER_CURE' 
  | 'REVERSIBLE_AFTER_APPROVAL' 
  | 'IRREVERSIBLE_NEW_TRANSACTION_REQUIRED';

export type PdpCategory = 'COMPLIANCE' | 'PROCUREMENT' | 'BUDGET' | 'LIFECYCLE' | 'DOCUMENTATION';

export type PdpSeverity = 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';

export interface PdpRuleResult {
  decision: PdpDecisionType;
  reason_code?: PdpReasonCode;
  reason_category?: PdpCategory;
  severity?: PdpSeverity;
  reversibility?: PdpReversibility;
  operator_role_owner?: string;
  message?: string;
  next_action?: string;
}

export interface PdpDecision extends PdpRuleResult {
  /** The decision the API should enforce currently (e.g., ALLOW during shadow mode) */
  effectiveDecision: PdpDecisionType;
  
  /** The true governance outcome calculated by the PDP */
  evaluatedDecision: PdpDecisionType;

  /** True if the result was manipulated by Shadow Mode */
  isShadow: boolean;
}
