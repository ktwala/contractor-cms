import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsArray,
  IsUUID,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ============================================================================
// ENUMS
// ============================================================================

export enum LeaveTypeCode {
  ANNUAL = 'ANNUAL',
  SICK = 'SICK',
  MATERNITY = 'MATERNITY',
  PATERNITY = 'PATERNITY',
  FAMILY_RESPONSIBILITY = 'FAMILY_RESPONSIBILITY',
  STUDY = 'STUDY',
  UNPAID = 'UNPAID',
  COMPASSIONATE = 'COMPASSIONATE',
  CUSTOM = 'CUSTOM',
}

export enum LeaveRequestStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  TAKEN = 'TAKEN',
}

export enum LeaveAccrualType {
  MONTHLY = 'MONTHLY',
  ANNUAL = 'ANNUAL',
  OPENING_BALANCE = 'OPENING_BALANCE',
  ADJUSTMENT = 'ADJUSTMENT',
  CARRY_OVER = 'CARRY_OVER',
  FORFEIT = 'FORFEIT',
  ENCASHMENT = 'ENCASHMENT',
  TERMINATION_PAYOUT = 'TERMINATION_PAYOUT',
}

export enum LeaveHalf {
  FULL = 'FULL',
  AM = 'AM',
  PM = 'PM',
}

export enum AccrualFrequency {
  MONTHLY = 'MONTHLY',
  ANNUAL = 'ANNUAL',
  NONE = 'NONE',
}

export enum CycleType {
  CALENDAR_YEAR = 'CALENDAR_YEAR',
  ANNIVERSARY = 'ANNIVERSARY',
  CUSTOM = 'CUSTOM',
}

export enum Country {
  ZA = 'ZA',
  LS = 'LS',
}

// ============================================================================
// LEAVE TYPE DTOs
// ============================================================================

export class CreateLeaveTypeDto {
  @IsEnum(Country)
  country: Country;

  @IsEnum(LeaveTypeCode)
  code: LeaveTypeCode;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  defaultEntitlement: number;

  @IsOptional()
  @IsString()
  entitlementUnit?: string = 'DAYS';

  @IsNumber()
  @Min(0)
  accrualRate: number;

  @IsOptional()
  @IsEnum(AccrualFrequency)
  accrualFrequency?: AccrualFrequency = AccrualFrequency.MONTHLY;

  @IsOptional()
  @IsNumber()
  @Min(0)
  qualifyingMonths?: number = 0;

  @IsOptional()
  @IsEnum(CycleType)
  cycleType?: CycleType = CycleType.CALENDAR_YEAR;

  @IsOptional()
  @IsNumber()
  @Min(1)
  cycleLengthYears?: number = 1;

  @IsOptional()
  @IsBoolean()
  allowCarryOver?: boolean = true;

  @IsOptional()
  @IsNumber()
  maxCarryOverDays?: number;

  @IsOptional()
  @IsNumber()
  carryOverExpiryMonths?: number;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean = true;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  paidPercentage?: number = 100;

  @IsOptional()
  @IsBoolean()
  payoutOnTermination?: boolean = false;

  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean = true;

  @IsOptional()
  @IsBoolean()
  requiresCertificate?: boolean = false;

  @IsOptional()
  @IsNumber()
  certificateAfterDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minNoticeDays?: number = 0;

  @IsOptional()
  @IsNumber()
  maxConsecutiveDays?: number;

  @IsOptional()
  @IsBoolean()
  allowNegativeBalance?: boolean = false;

  @IsOptional()
  @IsNumber()
  maxNegativeDays?: number;

  @IsOptional()
  @IsBoolean()
  isStatutory?: boolean = false;

  @IsOptional()
  @IsNumber()
  sortOrder?: number = 100;
}

export class UpdateLeaveTypeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultEntitlement?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  accrualRate?: number;

  @IsOptional()
  @IsBoolean()
  allowCarryOver?: boolean;

  @IsOptional()
  @IsNumber()
  maxCarryOverDays?: number;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  paidPercentage?: number;

  @IsOptional()
  @IsBoolean()
  requiresCertificate?: boolean;

  @IsOptional()
  @IsNumber()
  certificateAfterDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class LeaveTypeResponseDto {
  id: string;
  country: Country;
  code: LeaveTypeCode;
  name: string;
  description?: string;
  defaultEntitlement: number;
  entitlementUnit: string;
  accrualRate: number;
  accrualFrequency: string;
  qualifyingMonths: number;
  cycleType: string;
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
  isActive: boolean;
  isStatutory: boolean;
  sortOrder: number;
}

// ============================================================================
// LEAVE BALANCE DTOs
// ============================================================================

export class LeaveBalanceResponseDto {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: LeaveTypeCode;
  cycleStartDate: string;
  cycleEndDate: string;
  openingBalance: number;
  accrued: number;
  taken: number;
  pending: number;
  adjustment: number;
  forfeited: number;
  encashed: number;
  currentBalance: number;
  availableBalance: number;
  carryOverBalance: number;
  carryOverExpiresAt?: string;
}

export class LeaveBalanceSummaryDto {
  employeeId: string;
  employeeName: string;
  asOfDate: string;
  balances: LeaveBalanceResponseDto[];
}

export class AdjustBalanceDto {
  @IsUUID()
  employeeId: string;

  @IsUUID()
  leaveTypeId: string;

  @IsNumber()
  adjustmentDays: number;

  @IsEnum(LeaveAccrualType)
  adjustmentType: LeaveAccrualType;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  reference?: string;
}

// ============================================================================
// LEAVE REQUEST DTOs
// ============================================================================

export class CreateLeaveRequestDto {
  @IsUUID()
  leaveTypeId: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsEnum(LeaveHalf)
  startHalf?: LeaveHalf = LeaveHalf.FULL;

  @IsOptional()
  @IsEnum(LeaveHalf)
  endHalf?: LeaveHalf = LeaveHalf.FULL;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  allowNegativeBalance?: boolean = false;
}

export class UpdateLeaveRequestDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(LeaveHalf)
  startHalf?: LeaveHalf;

  @IsOptional()
  @IsEnum(LeaveHalf)
  endHalf?: LeaveHalf;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReviewLeaveRequestDto {
  @IsEnum(LeaveRequestStatus)
  status: LeaveRequestStatus.APPROVED | LeaveRequestStatus.REJECTED;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class CancelLeaveRequestDto {
  @IsString()
  reason: string;
}

export class LeaveRequestResponseDto {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: LeaveTypeCode;
  startDate: string;
  endDate: string;
  startHalf?: string;
  endHalf?: string;
  totalDays: number;
  totalHours?: number;
  reason?: string;
  notes?: string;
  certificateRequired: boolean;
  certificateUploaded: boolean;
  certificateUrl?: string;
  status: LeaveRequestStatus;
  submittedAt: string;
  submittedBy: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewComment?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancelReason?: string;
  affectsPayroll: boolean;
  deductionAmount?: number;
  paidAmount?: number;
}

export class LeaveRequestListQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  leaveTypeId?: string;

  @IsOptional()
  @IsEnum(LeaveRequestStatus)
  status?: LeaveRequestStatus;

  @IsOptional()
  @IsDateString()
  startDateFrom?: string;

  @IsOptional()
  @IsDateString()
  startDateTo?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

// ============================================================================
// LEAVE ACCRUAL DTOs
// ============================================================================

export class RunAccrualDto {
  @IsDateString()
  accrualDate: string;

  @IsOptional()
  @IsUUID()
  payPeriodId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  employeeIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  leaveTypeIds?: string[];
}

export class LeaveAccrualResponseDto {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  accrualDate: string;
  accrualType: LeaveAccrualType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  payPeriodId?: string;
  leaveRequestId?: string;
  reference?: string;
  notes?: string;
  createdAt: string;
  createdBy?: string;
}

export class AccrualRunResultDto {
  accrualDate: string;
  employeesProcessed: number;
  accrualsCreated: number;
  totalDaysAccrued: number;
  errors: Array<{
    employeeId: string;
    employeeName: string;
    error: string;
  }>;
}

// ============================================================================
// LEAVE POLICY DTOs
// ============================================================================

export class ServiceTierDto {
  @IsNumber()
  @Min(0)
  minYears: number;

  @IsNumber()
  @Min(0)
  entitlement: number;
}

export class CreateLeavePolicyDto {
  @IsOptional()
  @IsUUID()
  payGroupId?: string;

  @IsUUID()
  leaveTypeId: string;

  @IsEnum(Country)
  country: Country;

  @IsOptional()
  @IsNumber()
  @Min(0)
  entitlementDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  accrualRate?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceTierDto)
  serviceTiers?: ServiceTierDto[];

  @IsOptional()
  employmentTypeRules?: Record<string, number>;

  @IsOptional()
  additionalRules?: Record<string, any>;

  @IsDateString()
  effectiveFrom: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

export class LeavePolicyResponseDto {
  id: string;
  organizationId: string;
  payGroupId?: string;
  leaveTypeId: string;
  leaveTypeName: string;
  country: Country;
  entitlementDays?: number;
  accrualRate?: number;
  serviceTiers?: ServiceTierDto[];
  employmentTypeRules?: Record<string, number>;
  additionalRules?: Record<string, any>;
  effectiveFrom: string;
  effectiveTo?: string;
  isActive: boolean;
}

// ============================================================================
// PUBLIC HOLIDAY DTOs
// ============================================================================

export class CreatePublicHolidayDto {
  @IsEnum(Country)
  country: Country;

  @IsNumber()
  @Min(2000)
  @Max(2100)
  year: number;

  @IsDateString()
  date: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  localName?: string;

  @IsOptional()
  @IsDateString()
  observedDate?: string;

  @IsOptional()
  @IsBoolean()
  isNational?: boolean = true;

  @IsOptional()
  @IsString()
  region?: string;
}

export class PublicHolidayResponseDto {
  id: string;
  country: Country;
  year: number;
  date: string;
  name: string;
  localName?: string;
  observedDate?: string;
  isNational: boolean;
  region?: string;
}

// ============================================================================
// LEAVE CALENDAR DTOs
// ============================================================================

export class LeaveCalendarQueryDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  payGroupId?: string;

  @IsOptional()
  @IsEnum(Country)
  country?: Country;

  @IsOptional()
  @IsBoolean()
  includePublicHolidays?: boolean = true;
}

export class LeaveCalendarDayDto {
  date: string;
  dayOfWeek: number;
  isWeekend: boolean;
  isPublicHoliday: boolean;
  publicHolidayName?: string;
  leaveRequests: Array<{
    id: string;
    employeeId: string;
    employeeName: string;
    leaveTypeName: string;
    leaveTypeCode: LeaveTypeCode;
    status: LeaveRequestStatus;
    isHalfDay: boolean;
    half?: string;
  }>;
}

export class LeaveCalendarResponseDto {
  startDate: string;
  endDate: string;
  days: LeaveCalendarDayDto[];
  totalWorkingDays: number;
  totalPublicHolidays: number;
}

// ============================================================================
// WORKING DAYS CALCULATION DTOs
// ============================================================================

export class CalculateWorkingDaysDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsEnum(Country)
  country: Country;

  @IsOptional()
  @IsEnum(LeaveHalf)
  startHalf?: LeaveHalf = LeaveHalf.FULL;

  @IsOptional()
  @IsEnum(LeaveHalf)
  endHalf?: LeaveHalf = LeaveHalf.FULL;

  @IsOptional()
  @IsBoolean()
  excludePublicHolidays?: boolean = true;
}

export class WorkingDaysResultDto {
  startDate: string;
  endDate: string;
  totalCalendarDays: number;
  totalWorkingDays: number;
  weekends: number;
  publicHolidays: number;
  publicHolidayDates: Array<{
    date: string;
    name: string;
  }>;
}

// ============================================================================
// PAYROLL INTEGRATION DTOs
// ============================================================================

export class LeavePayrollImpactDto {
  employeeId: string;
  employeeName: string;
  leaveRequestId: string;
  leaveTypeCode: LeaveTypeCode;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  daysInPeriod: number;
  isPaid: boolean;
  paidPercentage: number;
  dailyRate: number;
  deductionAmount: number;
  paidAmount: number;
  notes?: string;
}

export class PayrunLeaveDeductionsDto {
  payrunId: string;
  periodStart: string;
  periodEnd: string;
  deductions: LeavePayrollImpactDto[];
  totalDeductions: number;
  totalPaidLeave: number;
}

// ============================================================================
// TERMINATION PAYOUT DTOs
// ============================================================================

export class CalculateTerminationPayoutDto {
  @IsUUID()
  employeeId: string;

  @IsDateString()
  terminationDate: string;

  @IsOptional()
  @IsBoolean()
  includeForfeited?: boolean = false;
}

export class TerminationPayoutResultDto {
  employeeId: string;
  employeeName: string;
  terminationDate: string;
  dailyRate: number;
  payouts: Array<{
    leaveTypeId: string;
    leaveTypeName: string;
    balanceDays: number;
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
// LEAVE REPORT DTOs
// ============================================================================

export class LeaveUtilizationReportDto {
  reportDate: string;
  period: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalEmployees: number;
    totalLeaveTypes: number;
    totalDaysTaken: number;
    totalDaysAvailable: number;
    utilizationRate: number;
  };
  byLeaveType: Array<{
    leaveTypeId: string;
    leaveTypeName: string;
    leaveTypeCode: LeaveTypeCode;
    totalEntitlement: number;
    totalTaken: number;
    totalPending: number;
    totalAvailable: number;
    utilizationRate: number;
  }>;
  byDepartment?: Array<{
    department: string;
    employeeCount: number;
    totalDaysTaken: number;
    averageDaysPerEmployee: number;
  }>;
}

export class LeaveLiabilityReportDto {
  reportDate: string;
  currency: string;
  totalLiability: number;
  byLeaveType: Array<{
    leaveTypeId: string;
    leaveTypeName: string;
    totalDays: number;
    averageDailyRate: number;
    liability: number;
  }>;
  byEmployee: Array<{
    employeeId: string;
    employeeName: string;
    dailyRate: number;
    balances: Array<{
      leaveTypeName: string;
      days: number;
      liability: number;
    }>;
    totalLiability: number;
  }>;
}
