/**
 * Lesotho Leave Pack
 *
 * Implements leave management rules according to:
 * - Labour Code Order 1992
 * - Labour Code (Amendment) Act 2000
 *
 * Key differences from South Africa:
 * - No UIF system
 * - Maternity is employer-paid at 66.67%
 * - Annual leave requires 12 months qualifying period
 * - Sick leave is 14 days per year (not 30 days over 3 years)
 * - No statutory paternity or family responsibility leave
 */

import { Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import {
  ICountryLeavePack,
  CountryLeaveConfig,
  LeaveTypeConfig,
  PublicHolidayConfig,
  EntitlementCalculationInput,
  EntitlementCalculationResult,
  AccrualCalculationInput,
  AccrualCalculationResult,
  PayImpactCalculationInput,
  PayDeductionResult,
  TerminationPayoutInput,
  TerminationPayoutResult,
  LeaveRequestValidationInput,
  LeaveRequestValidationResult,
  WorkingDaysInput,
  WorkingDaysResult,
} from '../../interfaces/leave-pack.interface';

@Injectable()
export class LSLeavePack implements ICountryLeavePack {
  readonly countryCode = 'LS';

  // Working days calculation for Lesotho
  private readonly WORKING_DAYS_PER_MONTH = 22;
  private readonly WORKING_HOURS_PER_DAY = 8;

  getLeaveConfig(): CountryLeaveConfig {
    return {
      countryCode: 'LS',
      countryName: 'Lesotho',
      workingDaysPerMonth: this.WORKING_DAYS_PER_MONTH,
      workingHoursPerDay: this.WORKING_HOURS_PER_DAY,
      weekendDays: [0, 6], // Sunday and Saturday
      leaveTypes: this.getLeaveTypes(),
    };
  }

  private getLeaveTypes(): LeaveTypeConfig[] {
    return [
      // Annual Leave - Labour Code Order 1992
      {
        code: 'ANNUAL',
        name: 'Annual Leave',
        description: '12 working days per year after 12 months continuous service',
        defaultEntitlement: 12,
        entitlementUnit: 'DAYS',
        accrualRate: 1, // 12 days / 12 months
        accrualFrequency: 'MONTHLY',
        qualifyingMonths: 12, // Must complete 12 months first
        cycleType: 'CALENDAR_YEAR',
        cycleLengthYears: 1,
        allowCarryOver: true,
        maxCarryOverDays: 12,
        carryOverExpiryMonths: 12,
        isPaid: true,
        paidPercentage: 100,
        payoutOnTermination: true,
        requiresApproval: true,
        requiresCertificate: false,
        minNoticeDays: 7,
        allowNegativeBalance: false,
        isStatutory: true,
        sortOrder: 1,
      },

      // Sick Leave - Labour Code Order 1992
      {
        code: 'SICK',
        name: 'Sick Leave',
        description: '14 working days per year with medical certificate',
        defaultEntitlement: 14,
        entitlementUnit: 'DAYS',
        accrualRate: 0, // Full entitlement at start of year
        accrualFrequency: 'NONE',
        qualifyingMonths: 0,
        cycleType: 'CALENDAR_YEAR', // Resets annually (not 3-year cycle like SA)
        cycleLengthYears: 1,
        allowCarryOver: false, // Does not accumulate
        isPaid: true,
        paidPercentage: 100,
        payoutOnTermination: false,
        requiresApproval: true,
        requiresCertificate: true,
        certificateAfterDays: 3, // Certificate required after 3 days (vs 2 in SA)
        minNoticeDays: 0,
        allowNegativeBalance: false,
        isStatutory: true,
        sortOrder: 2,
      },

      // Maternity Leave - Labour Code Order 1992
      // KEY DIFFERENCE: Employer pays 66.67% (no UIF in Lesotho)
      {
        code: 'MATERNITY',
        name: 'Maternity Leave',
        description: '12 weeks (6 before, 6 after birth) - Employer pays 66.67%',
        defaultEntitlement: 60, // 12 weeks × 5 working days
        entitlementUnit: 'DAYS',
        accrualRate: 0,
        accrualFrequency: 'NONE',
        qualifyingMonths: 0,
        cycleType: 'CALENDAR_YEAR',
        cycleLengthYears: 1,
        allowCarryOver: false,
        isPaid: true, // KEY DIFFERENCE: Employer pays
        paidPercentage: 66.67, // 2/3 of wages
        payoutOnTermination: false,
        requiresApproval: true,
        requiresCertificate: true,
        certificateAfterDays: 0,
        minNoticeDays: 14,
        maxConsecutiveDays: 60,
        allowNegativeBalance: false,
        isStatutory: true,
        sortOrder: 3,
      },

      // Paternity Leave - No statutory entitlement in Lesotho
      {
        code: 'PATERNITY',
        name: 'Paternity Leave',
        description: 'No statutory entitlement - company policy only',
        defaultEntitlement: 0, // No statutory entitlement
        entitlementUnit: 'DAYS',
        accrualRate: 0,
        accrualFrequency: 'NONE',
        qualifyingMonths: 0,
        cycleType: 'CALENDAR_YEAR',
        cycleLengthYears: 1,
        allowCarryOver: false,
        isPaid: true, // If granted, typically paid
        paidPercentage: 100,
        payoutOnTermination: false,
        requiresApproval: true,
        requiresCertificate: true,
        minNoticeDays: 0,
        allowNegativeBalance: false,
        isStatutory: false, // Not statutory
        sortOrder: 4,
      },

      // Family Responsibility Leave - No statutory entitlement in Lesotho
      {
        code: 'FAMILY_RESPONSIBILITY',
        name: 'Family Responsibility Leave',
        description: 'No statutory entitlement - company policy only',
        defaultEntitlement: 0,
        entitlementUnit: 'DAYS',
        accrualRate: 0,
        accrualFrequency: 'NONE',
        qualifyingMonths: 0,
        cycleType: 'CALENDAR_YEAR',
        cycleLengthYears: 1,
        allowCarryOver: false,
        isPaid: true,
        paidPercentage: 100,
        payoutOnTermination: false,
        requiresApproval: true,
        requiresCertificate: false,
        minNoticeDays: 0,
        allowNegativeBalance: false,
        isStatutory: false,
        sortOrder: 5,
      },

      // Compassionate Leave - Common company policy
      {
        code: 'COMPASSIONATE',
        name: 'Compassionate Leave',
        description: 'Bereavement leave - as per company policy',
        defaultEntitlement: 0,
        entitlementUnit: 'DAYS',
        accrualRate: 0,
        accrualFrequency: 'NONE',
        qualifyingMonths: 0,
        cycleType: 'CALENDAR_YEAR',
        cycleLengthYears: 1,
        allowCarryOver: false,
        isPaid: true,
        paidPercentage: 100,
        payoutOnTermination: false,
        requiresApproval: true,
        requiresCertificate: false,
        minNoticeDays: 0,
        allowNegativeBalance: false,
        isStatutory: false,
        sortOrder: 6,
      },

      // Study Leave
      {
        code: 'STUDY',
        name: 'Study Leave',
        description: 'Leave for examinations and study - as per company policy',
        defaultEntitlement: 0,
        entitlementUnit: 'DAYS',
        accrualRate: 0,
        accrualFrequency: 'NONE',
        qualifyingMonths: 0,
        cycleType: 'CALENDAR_YEAR',
        cycleLengthYears: 1,
        allowCarryOver: false,
        isPaid: true,
        paidPercentage: 100,
        payoutOnTermination: false,
        requiresApproval: true,
        requiresCertificate: true,
        minNoticeDays: 14,
        allowNegativeBalance: false,
        isStatutory: false,
        sortOrder: 7,
      },

      // Unpaid Leave
      {
        code: 'UNPAID',
        name: 'Unpaid Leave',
        description: 'Leave without pay - as agreed with employer',
        defaultEntitlement: 365,
        entitlementUnit: 'DAYS',
        accrualRate: 0,
        accrualFrequency: 'NONE',
        qualifyingMonths: 0,
        cycleType: 'CALENDAR_YEAR',
        cycleLengthYears: 1,
        allowCarryOver: false,
        isPaid: false,
        paidPercentage: 0,
        payoutOnTermination: false,
        requiresApproval: true,
        requiresCertificate: false,
        minNoticeDays: 7,
        allowNegativeBalance: false,
        isStatutory: false,
        sortOrder: 10,
      },
    ];
  }

  getPublicHolidays(year: number): PublicHolidayConfig[] {
    const holidays: PublicHolidayConfig[] = [
      { date: new Date(year, 0, 1), name: "New Year's Day", isNational: true },
      { date: new Date(year, 2, 11), name: "Moshoeshoe's Day", isNational: true },
      { date: new Date(year, 3, 4), name: "Heroes' Day", isNational: true },
      { date: new Date(year, 4, 1), name: "Workers' Day", isNational: true },
      { date: new Date(year, 6, 17), name: "King's Birthday", isNational: true },
      { date: new Date(year, 9, 4), name: 'Independence Day', isNational: true },
      { date: new Date(year, 11, 25), name: 'Christmas Day', isNational: true },
      { date: new Date(year, 11, 26), name: 'Boxing Day', isNational: true },
    ];

    // Add Easter-based holidays
    const easter = this.calculateEasterDate(year);
    holidays.push({
      date: new Date(easter.getTime() - 2 * 24 * 60 * 60 * 1000),
      name: 'Good Friday',
      isNational: true,
    });
    holidays.push({
      date: new Date(easter.getTime() + 1 * 24 * 60 * 60 * 1000),
      name: 'Easter Monday',
      isNational: true,
    });
    // Ascension Day - 39 days after Easter
    holidays.push({
      date: new Date(easter.getTime() + 39 * 24 * 60 * 60 * 1000),
      name: 'Ascension Day',
      isNational: true,
    });

    return holidays;
  }

  calculateEntitlement(input: EntitlementCalculationInput): EntitlementCalculationResult {
    const config = this.getLeaveTypes().find((lt) => lt.code === input.leaveTypeCode);
    if (!config) {
      return {
        baseEntitlement: 0,
        serviceBonus: 0,
        proRataAdjustment: 0,
        totalEntitlement: 0,
        trace: [{ step: 'error', description: 'Leave type not found', value: 0 }],
      };
    }

    const trace: Array<{ step: string; description: string; value: number }> = [];

    // Check qualifying period - KEY DIFFERENCE: LS requires 12 months for annual leave
    const monthsEmployed = this.getMonthsBetween(input.employee.hireDate, input.asOfDate);
    if (monthsEmployed < config.qualifyingMonths) {
      trace.push({
        step: 'qualifying_check',
        description: `Employee has ${monthsEmployed} months service, requires ${config.qualifyingMonths} months`,
        value: 0,
      });
      return {
        baseEntitlement: 0,
        serviceBonus: 0,
        proRataAdjustment: 0,
        totalEntitlement: 0,
        trace,
      };
    }

    // Base entitlement
    let baseEntitlement = config.defaultEntitlement;
    trace.push({
      step: 'base_entitlement',
      description: `Default entitlement for ${config.name}`,
      value: baseEntitlement,
    });

    // Service-based bonus (less common in Lesotho, but may be in company policy)
    let serviceBonus = 0;
    if (input.leaveTypeCode === 'ANNUAL' && input.employee.yearsOfService >= 10) {
      serviceBonus = Math.min(Math.floor((input.employee.yearsOfService - 10) / 5) * 2, 6);
      if (serviceBonus > 0) {
        trace.push({
          step: 'service_bonus',
          description: `Long service bonus for ${input.employee.yearsOfService} years`,
          value: serviceBonus,
        });
      }
    }

    // Pro-rata adjustment
    let proRataAdjustment = 0;
    // For annual leave in LS, pro-rata only after first year
    if (
      input.leaveTypeCode === 'ANNUAL' &&
      monthsEmployed >= 12 &&
      input.employee.hireDate > input.cycleStartDate
    ) {
      const monthsInCycle = this.getMonthsBetween(input.employee.hireDate, input.cycleEndDate);
      const fullMonthsInCycle = this.getMonthsBetween(input.cycleStartDate, input.cycleEndDate);
      const proRataFactor = monthsInCycle / fullMonthsInCycle;

      if (proRataFactor < 1) {
        proRataAdjustment = -((baseEntitlement + serviceBonus) * (1 - proRataFactor));
        trace.push({
          step: 'pro_rata',
          description: `Pro-rata adjustment (${Math.round(proRataFactor * 100)}% of year)`,
          value: proRataAdjustment,
        });
      }
    }

    const totalEntitlement = Math.max(0, baseEntitlement + serviceBonus + proRataAdjustment);
    trace.push({
      step: 'total',
      description: 'Total calculated entitlement',
      value: totalEntitlement,
    });

    return {
      baseEntitlement,
      serviceBonus,
      proRataAdjustment,
      totalEntitlement,
      trace,
    };
  }

  calculateAccrual(input: AccrualCalculationInput): AccrualCalculationResult {
    const config = this.getLeaveTypes().find((lt) => lt.code === input.leaveTypeCode);
    if (!config) {
      return {
        accrualAmount: 0,
        newBalance: input.currentBalance,
        isQualified: false,
        reason: 'Leave type not found',
      };
    }

    // KEY DIFFERENCE: Lesotho requires 12 months for annual leave accrual
    const monthsEmployed = this.getMonthsBetween(input.employee.hireDate, input.accrualDate);
    if (monthsEmployed < config.qualifyingMonths) {
      return {
        accrualAmount: 0,
        newBalance: input.currentBalance,
        isQualified: false,
        reason: `Employee must complete ${config.qualifyingMonths} months continuous service before accruing ${config.name}`,
      };
    }

    if (config.accrualFrequency === 'NONE') {
      return {
        accrualAmount: 0,
        newBalance: input.currentBalance,
        isQualified: true,
        reason: 'This leave type does not accrue monthly',
      };
    }

    const accrualAmount = config.accrualRate;
    const newBalance = input.currentBalance + accrualAmount;

    return {
      accrualAmount,
      newBalance,
      isQualified: true,
    };
  }

  calculatePayImpact(input: PayImpactCalculationInput): PayDeductionResult {
    const config = this.getLeaveTypes().find((lt) => lt.code === input.leaveTypeCode);
    if (!config) {
      return {
        deductionType: 'NONE',
        leaveDays: input.leaveDays,
        dailyRate: 0,
        deductionAmount: 0,
        paidAmount: 0,
        paidPercentage: 0,
        notes: 'Leave type not found',
      };
    }

    const dailyRate = this.calculateDailyRate(input.employee.monthlySalary);

    // KEY DIFFERENCE: Maternity in Lesotho is 66.67% employer paid
    if (input.leaveTypeCode === 'MATERNITY') {
      const paidAmount = dailyRate * input.leaveDays * 0.6667;
      const deductionAmount = dailyRate * input.leaveDays * 0.3333;

      return {
        deductionType: 'PARTIAL',
        leaveDays: input.leaveDays,
        dailyRate,
        deductionAmount,
        paidAmount,
        paidPercentage: 66.67,
        notes: 'Employer pays 66.67% of wages during maternity leave (Labour Code Order 1992)',
      };
    }

    // Unpaid leave
    if (!config.isPaid) {
      return {
        deductionType: 'FULL',
        leaveDays: input.leaveDays,
        dailyRate,
        deductionAmount: dailyRate * input.leaveDays,
        paidAmount: 0,
        paidPercentage: 0,
      };
    }

    // Partially paid leave
    if (config.paidPercentage < 100) {
      const paidAmount = dailyRate * input.leaveDays * (config.paidPercentage / 100);
      const deductionAmount = dailyRate * input.leaveDays - paidAmount;

      return {
        deductionType: 'PARTIAL',
        leaveDays: input.leaveDays,
        dailyRate,
        deductionAmount,
        paidAmount,
        paidPercentage: config.paidPercentage,
      };
    }

    // Fully paid leave
    return {
      deductionType: 'NONE',
      leaveDays: input.leaveDays,
      dailyRate,
      deductionAmount: 0,
      paidAmount: dailyRate * input.leaveDays,
      paidPercentage: 100,
    };
  }

  calculateTerminationPayout(input: TerminationPayoutInput): TerminationPayoutResult {
    const payouts: TerminationPayoutResult['payouts'] = [];
    let totalPayoutDays = 0;
    let totalPayoutAmount = 0;
    let forfeitedDays = 0;
    let forfeitedAmount = 0;

    const dailyRate = this.calculateDailyRate(input.employee.monthlySalary);

    // Check if employee has completed qualifying period for annual leave
    const monthsEmployed = this.getMonthsBetween(input.employee.hireDate, input.terminationDate);

    for (const balance of input.leaveBalances) {
      const config = this.getLeaveTypes().find((lt) => lt.code === balance.leaveTypeCode);
      if (!config) continue;

      // For annual leave, only pay out if employee completed 12 months
      if (balance.leaveTypeCode === 'ANNUAL' && monthsEmployed < 12) {
        if (balance.balance > 0) {
          payouts.push({
            leaveTypeCode: balance.leaveTypeCode,
            leaveTypeName: config.name,
            balanceDays: balance.balance,
            dailyRate,
            payoutAmount: 0,
            isPayable: false,
            reason: 'Employee has not completed 12 months qualifying period',
          });
          forfeitedDays += balance.balance;
          forfeitedAmount += dailyRate * balance.balance;
        }
        continue;
      }

      if (config.payoutOnTermination && balance.balance > 0) {
        const payoutAmount = dailyRate * balance.balance;
        payouts.push({
          leaveTypeCode: balance.leaveTypeCode,
          leaveTypeName: config.name,
          balanceDays: balance.balance,
          dailyRate,
          payoutAmount,
          isPayable: true,
        });
        totalPayoutDays += balance.balance;
        totalPayoutAmount += payoutAmount;
      } else if (balance.balance > 0) {
        const forfeitAmount = dailyRate * balance.balance;
        payouts.push({
          leaveTypeCode: balance.leaveTypeCode,
          leaveTypeName: config.name,
          balanceDays: balance.balance,
          dailyRate,
          payoutAmount: 0,
          isPayable: false,
          reason: `${config.name} is not payable on termination`,
        });
        forfeitedDays += balance.balance;
        forfeitedAmount += forfeitAmount;
      }
    }

    return {
      payouts,
      totalPayoutDays,
      totalPayoutAmount,
      forfeitedDays,
      forfeitedAmount,
    };
  }

  validateLeaveRequest(input: LeaveRequestValidationInput): LeaveRequestValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const config = this.getLeaveTypes().find((lt) => lt.code === input.leaveTypeCode);
    if (!config) {
      return {
        isValid: false,
        errors: ['Leave type not found'],
        warnings: [],
        requiresCertificate: false,
      };
    }

    // KEY DIFFERENCE: Check 12-month qualifying period for annual leave
    const monthsEmployed = this.getMonthsBetween(input.employee.hireDate, input.startDate);
    if (monthsEmployed < config.qualifyingMonths) {
      errors.push(
        `Employee must complete ${config.qualifyingMonths} months continuous service before taking ${config.name}`,
      );
    }

    // Check for non-statutory leave types
    if (!config.isStatutory && config.defaultEntitlement === 0) {
      warnings.push(
        `${config.name} has no statutory entitlement in Lesotho. Check company policy.`,
      );
    }

    // Check available balance
    const availableBalance = input.currentBalance - input.pendingDays;
    if (input.totalDays > availableBalance && !config.allowNegativeBalance) {
      errors.push(
        `Insufficient balance. Available: ${availableBalance} days, Requested: ${input.totalDays} days`,
      );
    }

    // Check maximum consecutive days
    if (config.maxConsecutiveDays && input.totalDays > config.maxConsecutiveDays) {
      errors.push(`Maximum consecutive days for ${config.name} is ${config.maxConsecutiveDays}`);
    }

    // Check notice period
    if (config.minNoticeDays > 0) {
      const daysUntilStart = Math.ceil(
        (input.startDate.getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000),
      );
      if (daysUntilStart < config.minNoticeDays) {
        warnings.push(
          `${config.name} requires ${config.minNoticeDays} days notice.`,
        );
      }
    }

    // Determine if certificate is required
    let requiresCertificate = config.requiresCertificate;
    if (config.certificateAfterDays && input.totalDays > config.certificateAfterDays) {
      requiresCertificate = true;
    }

    // Estimate deduction (important for maternity in LS)
    let estimatedDeduction = 0;
    if (!config.isPaid || config.paidPercentage < 100) {
      const dailyRate = this.calculateDailyRate(input.employee.monthlySalary);
      if (!config.isPaid) {
        estimatedDeduction = dailyRate * input.totalDays;
      } else {
        estimatedDeduction = dailyRate * input.totalDays * ((100 - config.paidPercentage) / 100);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      requiresCertificate,
      estimatedDeduction: estimatedDeduction > 0 ? estimatedDeduction : undefined,
    };
  }

  calculateWorkingDays(input: WorkingDaysInput): WorkingDaysResult {
    let currentDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    let totalCalendarDays = 0;
    let totalWorkingDays = 0;
    let weekends = 0;
    let publicHolidaysExcluded = 0;

    const holidayDates = new Set(
      input.publicHolidays.map((h) => h.toISOString().split('T')[0]),
    );

    while (currentDate <= endDate) {
      totalCalendarDays++;
      const dayOfWeek = currentDate.getDay();
      const dateString = currentDate.toISOString().split('T')[0];

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        weekends++;
      } else if (input.excludePublicHolidays && holidayDates.has(dateString)) {
        publicHolidaysExcluded++;
      } else {
        totalWorkingDays++;
      }

      currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
    }

    let halfDayAdjustment = 0;
    if (input.startHalf === 'PM') {
      halfDayAdjustment -= 0.5;
    }
    if (input.endHalf === 'AM') {
      halfDayAdjustment -= 0.5;
    }

    return {
      totalCalendarDays,
      totalWorkingDays: totalWorkingDays + halfDayAdjustment,
      weekends,
      publicHolidaysExcluded,
      halfDayAdjustment,
    };
  }

  getCycleDates(
    leaveTypeCode: string,
    referenceDate: Date,
    hireDate: Date,
  ): { startDate: Date; endDate: Date } {
    const year = referenceDate.getFullYear();

    // Lesotho uses calendar year for all leave cycles
    return {
      startDate: new Date(year, 0, 1),
      endDate: new Date(year, 11, 31),
    };
  }

  calculateDailyRate(monthlySalary: Decimal): number {
    return Number(monthlySalary) / this.WORKING_DAYS_PER_MONTH;
  }

  // Helper: Calculate Easter date
  private calculateEasterDate(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
    const day = ((h + l - 7 * m + 114) % 31) + 1;

    return new Date(year, month, day);
  }

  // Helper: Calculate months between two dates
  private getMonthsBetween(startDate: Date, endDate: Date): number {
    const years = endDate.getFullYear() - startDate.getFullYear();
    const months = endDate.getMonth() - startDate.getMonth();
    const days = endDate.getDate() - startDate.getDate();

    let totalMonths = years * 12 + months;
    if (days < 0) {
      totalMonths -= 1;
    }

    return Math.max(0, totalMonths);
  }
}
