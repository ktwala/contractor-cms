import { PayrunExceptionType, PayrunExceptionSeverity } from '@prisma/client';

export interface ExceptionRule {
  severity: PayrunExceptionSeverity;
  blocksSubmission: boolean;
  blocksPayment: boolean;
}

export const EXCEPTION_RULES: Record<PayrunExceptionType, ExceptionRule> = {
  MISSING_BANK_DETAILS:          { severity: 'CRITICAL', blocksSubmission: false, blocksPayment: true },
  MISSING_TAX_NUMBER:            { severity: 'CRITICAL', blocksSubmission: true,  blocksPayment: true },
  MISSING_PAY_INPUT:             { severity: 'HIGH',     blocksSubmission: false, blocksPayment: false },
  NEGATIVE_NET_PAY:              { severity: 'CRITICAL', blocksSubmission: true,  blocksPayment: true },
  ZERO_NET_PAY_UNEXPECTED:       { severity: 'MEDIUM',   blocksSubmission: false, blocksPayment: false },
  INVALID_DEDUCTION_TOTAL:       { severity: 'HIGH',     blocksSubmission: true,  blocksPayment: true },
  OVERTIME_THRESHOLD_BREACH:     { severity: 'MEDIUM',   blocksSubmission: false, blocksPayment: false },
  INACTIVE_EMPLOYEE_INCLUDED:    { severity: 'HIGH',     blocksSubmission: true,  blocksPayment: true },
  TERMINATED_EMPLOYEE_INCLUDED:  { severity: 'HIGH',     blocksSubmission: true,  blocksPayment: true },
  DUPLICATE_EMPLOYEE_IN_RUN:     { severity: 'CRITICAL', blocksSubmission: true,  blocksPayment: true },
  MISSING_EMPLOYMENT_ASSIGNMENT: { severity: 'HIGH',     blocksSubmission: true,  blocksPayment: true },
  MISSING_PAY_GROUP_MAPPING:     { severity: 'HIGH',     blocksSubmission: true,  blocksPayment: true },
  CALCULATION_ANOMALY:           { severity: 'CRITICAL', blocksSubmission: true,  blocksPayment: true },
  UNUSUAL_VARIANCE:              { severity: 'HIGH',     blocksSubmission: false, blocksPayment: false },
  PAYMENT_DATE_MISMATCH:         { severity: 'MEDIUM',   blocksSubmission: false, blocksPayment: false },
  RUN_CONFIGURATION_WARNING:     { severity: 'LOW',      blocksSubmission: false, blocksPayment: false },
  MISSING_TAX_PROFILE:           { severity: 'HIGH',     blocksSubmission: true,  blocksPayment: true },
  MISSING_BANK_VERIFICATION:     { severity: 'HIGH',     blocksSubmission: false, blocksPayment: true },
  MISSING_IDENTIFICATION:        { severity: 'HIGH',     blocksSubmission: true,  blocksPayment: true },
  ON_LEAVE_EMPLOYEE_INCLUDED:    { severity: 'MEDIUM',   blocksSubmission: false, blocksPayment: false },
  DEDUCTIONS_EXCEED_GROSS:       { severity: 'HIGH',     blocksSubmission: true,  blocksPayment: true },
};

export function getExceptionRule(type: PayrunExceptionType): ExceptionRule {
  return EXCEPTION_RULES[type] ?? { severity: 'MEDIUM', blocksSubmission: false, blocksPayment: false };
}
