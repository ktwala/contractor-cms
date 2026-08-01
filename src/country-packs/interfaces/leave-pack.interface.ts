/**
 * Leave Pack Interface
 *
 * Defines the contract for country-specific leave management rules.
 * Each country pack implements this interface to provide:
 * - Leave type configurations
 * - Entitlement calculations
 * - Accrual rules
 * - Pay impact calculations
 * - Public holidays
 */

import { Decimal } from 'decimal.js';

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface LeaveTypeConfig {
  code: string;
  name: string;
  description?: string;
  defaultEntitlement: number;
  entitlementUnit: 'DAYS' | 'HOURS';
  accrualRate: number;
  accrualFrequency: 'MONTHLY' | 'ANNUAL' | 'NONE';
  qualifyingMonths: number;
  cycleType: 'CALENDAR_YEAR' | 'ANNIVERSARY' | 'SICK_CYCLE';
  cycleLengthYears: number;
  allowCarryOver: boolean;
  maxCarryOverDays?: number;
  carryOverExpiryMonths?: number;
  isPaid: boolean;
  paidPercentage: number;
  payoutOnTermination: boolean;
  requiresApproval: boolean;
  requiresCertificate: boolean;
  certificateAfterDays?: number;
  minNoticeDays: number;
  maxConsecutiveDays?: number;
  allowNegativeBalance: boolean;
  maxNegativeDays?: number;
  isStatutory: boolean;
  sortOrder: number;
}

export interface CountryLeaveConfig {
  countryCode: string;
  countryName: string;
  workingDaysPerMonth: number;
  workingHoursPerDay: number;
  weekendDays: number[]; // 0=Sunday, 6=Saturday
  leaveTypes: LeaveTypeConfig[];
}

export interface PublicHolidayConfig {
  date: Date;
  name: string;
  localName?: string;
  isNational: boolean;
  region?: string;
}

// ============================================================================
// EMPLOYEE CONTEXT
// ============================================================================

export interface EmployeeLeaveContext {
  id: string;
  hireDate: Date;
  terminationDate?: Date;
  employmentType: 'PERMANENT' | 'CONTRACT' | 'CASUAL';
  country: string;
  monthlySalary: Decimal;
  yearsOfService: number;
  age?: number;
}

// ============================================================================
// ENTITLEMENT CALCULATION
// ============================================================================

export interface EntitlementCalculationInput {
  employee: EmployeeLeaveContext;
  leaveTypeCode: string;
  asOfDate: Date;
  cycleStartDate: Date;
  cycleEndDate: Date;
}

export interface EntitlementCalculationResult {
  baseEntitlement: number;
  serviceBonus: number; // Additional days based on years of service
  proRataAdjustment: number; // For partial years
  totalEntitlement: number;
  trace: Array<{
    step: string;
    description: string;
    value: number;
  }>;
}

// ============================================================================
// ACCRUAL CALCULATION
// ============================================================================

export interface AccrualCalculationInput {
  employee: EmployeeLeaveContext;
  leaveTypeCode: string;
  accrualDate: Date;
  currentBalance: number;
  cycleStartDate: Date;
}

export interface AccrualCalculationResult {
  accrualAmount: number;
  newBalance: number;
  isQualified: boolean; // Has employee met qualifying period?
  reason?: string; // Why accrual was 0 or adjusted
}

// ============================================================================
// PAY IMPACT CALCULATION
// ============================================================================

export interface PayImpactCalculationInput {
  employee: EmployeeLeaveContext;
  leaveTypeCode: string;
  leaveDays: number;
  startDate: Date;
  endDate: Date;
}

export interface PayDeductionResult {
  deductionType: 'NONE' | 'PARTIAL' | 'FULL';
  leaveDays: number;
  dailyRate: number;
  deductionAmount: number;
  paidAmount: number;
  paidPercentage: number;
  notes?: string;
}

// ============================================================================
// TERMINATION PAYOUT
// ============================================================================

export interface TerminationPayoutInput {
  employee: EmployeeLeaveContext;
  terminationDate: Date;
  leaveBalances: Array<{
    leaveTypeCode: string;
    balance: number;
  }>;
}

export interface TerminationPayoutResult {
  payouts: Array<{
    leaveTypeCode: string;
    leaveTypeName: string;
    balanceDays: number;
    dailyRate: number;
    payoutAmount: number;
    isPayable: boolean;
    reason?: string;
  }>;
  totalPayoutDays: number;
  totalPayoutAmount: number;
  forfeitedDays: number;
  forfeitedAmount: number;
}

// ============================================================================
// LEAVE REQUEST VALIDATION
// ============================================================================

export interface LeaveRequestValidationInput {
  employee: EmployeeLeaveContext;
  leaveTypeCode: string;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  currentBalance: number;
  pendingDays: number;
}

export interface LeaveRequestValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiresCertificate: boolean;
  estimatedDeduction?: number;
}

// ============================================================================
// WORKING DAYS CALCULATION
// ============================================================================

export interface WorkingDaysInput {
  startDate: Date;
  endDate: Date;
  startHalf?: 'FULL' | 'AM' | 'PM';
  endHalf?: 'FULL' | 'AM' | 'PM';
  excludePublicHolidays: boolean;
  publicHolidays: Date[];
}

export interface WorkingDaysResult {
  totalCalendarDays: number;
  totalWorkingDays: number;
  weekends: number;
  publicHolidaysExcluded: number;
  halfDayAdjustment: number;
}

// ============================================================================
// LEAVE PACK INTERFACE
// ============================================================================

export interface ICountryLeavePack {
  /**
   * Country code this pack applies to
   */
  readonly countryCode: string;

  /**
   * Get the complete leave configuration for this country
   */
  getLeaveConfig(): CountryLeaveConfig;

  /**
   * Get public holidays for a specific year
   */
  getPublicHolidays(year: number): PublicHolidayConfig[];

  /**
   * Calculate leave entitlement for an employee
   */
  calculateEntitlement(input: EntitlementCalculationInput): EntitlementCalculationResult;

  /**
   * Calculate monthly/periodic accrual
   */
  calculateAccrual(input: AccrualCalculationInput): AccrualCalculationResult;

  /**
   * Calculate pay deduction for leave taken
   */
  calculatePayImpact(input: PayImpactCalculationInput): PayDeductionResult;

  /**
   * Calculate termination payout for unused leave
   */
  calculateTerminationPayout(input: TerminationPayoutInput): TerminationPayoutResult;

  /**
   * Validate a leave request against country rules
   */
  validateLeaveRequest(input: LeaveRequestValidationInput): LeaveRequestValidationResult;

  /**
   * Calculate working days between two dates
   */
  calculateWorkingDays(input: WorkingDaysInput): WorkingDaysResult;

  /**
   * Get the cycle dates for a leave type
   */
  getCycleDates(
    leaveTypeCode: string,
    referenceDate: Date,
    hireDate: Date,
  ): { startDate: Date; endDate: Date };

  /**
   * Calculate daily rate for an employee
   */
  calculateDailyRate(monthlySalary: Decimal): number;
}
