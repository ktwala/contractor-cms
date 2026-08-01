/**
 * South Africa Leave Pack
 *
 * Implements leave management rules according to:
 * - Basic Conditions of Employment Act (BCEA)
 * - Labour Relations Act
 * - Unemployment Insurance Act (for UIF-related leave claims)
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
export class ZALeavePack implements ICountryLeavePack {
  readonly countryCode = 'ZA';

  // Working days calculation: 21.67 is standard for SA (260 working days / 12 months)
  private readonly WORKING_DAYS_PER_MONTH = 21.67;
  private readonly WORKING_HOURS_PER_DAY = 8;

  getLeaveConfig(): CountryLeaveConfig {
    return {
      countryCode: 'ZA',
      countryName: 'South Africa',
      workingDaysPerMonth: this.WORKING_DAYS_PER_MONTH,
      workingHoursPerDay: this.WORKING_HOURS_PER_DAY,
      weekendDays: [0, 6], // Sunday and Saturday
      leaveTypes: this.getLeaveTypes(),
    };
  }

  private getLeaveTypes(): LeaveTypeConfig[] {
    return [
      // Annual Leave - BCEA Section 20
      {
        code: 'ANNUAL',
        name: 'Annual Leave',
        description: '21 consecutive days or 15 working days per year as per BCEA',
        defaultEntitlement: 15,
        entitlementUnit: 'DAYS',
        accrualRate: 1.25, // 15 days / 12 months
        accrualFrequency: 'MONTHLY',
        qualifyingMonths: 0, // Accrues from day 1
        cycleType: 'CALENDAR_YEAR',
        cycleLengthYears: 1,
        allowCarryOver: true,
        maxCarryOverDays: 15,
        carryOverExpiryMonths: 6, // Must take within 6 months of new cycle
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

      // Sick Leave - BCEA Section 22
      {
        code: 'SICK',
        name: 'Sick Leave',
        description: '30 working days over a 3-year cycle as per BCEA',
        defaultEntitlement: 30,
        entitlementUnit: 'DAYS',
        accrualRate: 0, // Full entitlement at start of cycle
        accrualFrequency: 'NONE',
        qualifyingMonths: 0,
        cycleType: 'SICK_CYCLE', // 3-year rolling cycle from employment start
        cycleLengthYears: 3,
        allowCarryOver: false, // Does not carry over
        isPaid: true,
        paidPercentage: 100,
        payoutOnTermination: false, // Not paid out
        requiresApproval: true,
        requiresCertificate: true,
        certificateAfterDays: 2, // Certificate required for >2 consecutive days
        minNoticeDays: 0,
        allowNegativeBalance: false,
        isStatutory: true,
        sortOrder: 2,
      },

      // Maternity Leave - BCEA Section 25
      {
        code: 'MATERNITY',
        name: 'Maternity Leave',
        description: '4 consecutive months (17.32 weeks) - Unpaid, claim from UIF',
        defaultEntitlement: 86.6, // 4 months × 21.67 working days
        entitlementUnit: 'DAYS',
        accrualRate: 0,
        accrualFrequency: 'NONE',
        qualifyingMonths: 0,
        cycleType: 'CALENDAR_YEAR',
        cycleLengthYears: 1,
        allowCarryOver: false,
        isPaid: false, // Employee claims from UIF
        paidPercentage: 0,
        payoutOnTermination: false,
        requiresApproval: true,
        requiresCertificate: true,
        certificateAfterDays: 0,
        minNoticeDays: 28, // 4 weeks notice required
        maxConsecutiveDays: 87,
        allowNegativeBalance: false,
        isStatutory: true,
        sortOrder: 3,
      },

      // Paternity Leave - Labour Laws Amendment Act 2020
      {
        code: 'PATERNITY',
        name: 'Paternity Leave',
        description: '10 consecutive days - Unpaid, can claim from UIF',
        defaultEntitlement: 10,
        entitlementUnit: 'DAYS',
        accrualRate: 0,
        accrualFrequency: 'NONE',
        qualifyingMonths: 0,
        cycleType: 'CALENDAR_YEAR',
        cycleLengthYears: 1,
        allowCarryOver: false,
        isPaid: false, // Can claim from UIF
        paidPercentage: 0,
        payoutOnTermination: false,
        requiresApproval: true,
        requiresCertificate: true,
        certificateAfterDays: 0,
        minNoticeDays: 0, // Must start from date of birth
        maxConsecutiveDays: 10,
        allowNegativeBalance: false,
        isStatutory: true,
        sortOrder: 4,
      },

      // Family Responsibility Leave - BCEA Section 27
      {
        code: 'FAMILY_RESPONSIBILITY',
        name: 'Family Responsibility Leave',
        description: '3 days per year for birth, illness, or death of family member',
        defaultEntitlement: 3,
        entitlementUnit: 'DAYS',
        accrualRate: 0,
        accrualFrequency: 'NONE',
        qualifyingMonths: 4, // Must have worked for 4+ months
        cycleType: 'CALENDAR_YEAR',
        cycleLengthYears: 1,
        allowCarryOver: false, // Does not accumulate
        isPaid: true,
        paidPercentage: 100,
        payoutOnTermination: false,
        requiresApproval: true,
        requiresCertificate: false, // Employer may require proof
        minNoticeDays: 0,
        allowNegativeBalance: false,
        isStatutory: true,
        sortOrder: 5,
      },

      // Study Leave - Not statutory, company policy
      {
        code: 'STUDY',
        name: 'Study Leave',
        description: 'Leave for examinations and study - as per company policy',
        defaultEntitlement: 0, // Set by company policy
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
        sortOrder: 6,
      },

      // Unpaid Leave
      {
        code: 'UNPAID',
        name: 'Unpaid Leave',
        description: 'Leave without pay - as agreed with employer',
        defaultEntitlement: 365, // Unlimited within reason
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
      { date: new Date(year, 2, 21), name: 'Human Rights Day', isNational: true },
      { date: new Date(year, 3, 27), name: 'Freedom Day', isNational: true },
      { date: new Date(year, 4, 1), name: "Workers' Day", isNational: true },
      { date: new Date(year, 5, 16), name: 'Youth Day', isNational: true },
      { date: new Date(year, 7, 9), name: "National Women's Day", isNational: true },
      { date: new Date(year, 8, 24), name: 'Heritage Day', isNational: true },
      { date: new Date(year, 11, 16), name: 'Day of Reconciliation', isNational: true },
      { date: new Date(year, 11, 25), name: 'Christmas Day', isNational: true },
      { date: new Date(year, 11, 26), name: 'Day of Goodwill', isNational: true },
    ];

    // Add Easter dates (calculated)
    const easter = this.calculateEasterDate(year);
    holidays.push({
      date: new Date(easter.getTime() - 2 * 24 * 60 * 60 * 1000),
      name: 'Good Friday',
      isNational: true,
    });
    holidays.push({
      date: new Date(easter.getTime() + 1 * 24 * 60 * 60 * 1000),
      name: 'Family Day',
      localName: 'Easter Monday',
      isNational: true,
    });

    // Handle observed dates (when holiday falls on Sunday, observe on Monday)
    return holidays.map((holiday) => {
      if (holiday.date.getDay() === 0) {
        return {
          ...holiday,
          observedDate: new Date(holiday.date.getTime() + 24 * 60 * 60 * 1000),
        };
      }
      return holiday;
    });
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

    // Base entitlement
    let baseEntitlement = config.defaultEntitlement;
    trace.push({
      step: 'base_entitlement',
      description: `Default entitlement for ${config.name}`,
      value: baseEntitlement,
    });

    // Service-based bonus (for annual leave, typically after 5 years)
    let serviceBonus = 0;
    if (input.leaveTypeCode === 'ANNUAL' && input.employee.yearsOfService >= 5) {
      // Common SA practice: 1 additional day per year of service after 5 years
      serviceBonus = Math.min(input.employee.yearsOfService - 5, 5);
      trace.push({
        step: 'service_bonus',
        description: `Service bonus for ${input.employee.yearsOfService} years`,
        value: serviceBonus,
      });
    }

    // Pro-rata adjustment for new employees
    let proRataAdjustment = 0;
    if (input.employee.hireDate > input.cycleStartDate) {
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

    // Check qualifying period
    const monthsEmployed = this.getMonthsBetween(input.employee.hireDate, input.accrualDate);
    if (monthsEmployed < config.qualifyingMonths) {
      return {
        accrualAmount: 0,
        newBalance: input.currentBalance,
        isQualified: false,
        reason: `Employee has not completed qualifying period of ${config.qualifyingMonths} months`,
      };
    }

    // Check accrual frequency
    if (config.accrualFrequency === 'NONE') {
      return {
        accrualAmount: 0,
        newBalance: input.currentBalance,
        isQualified: true,
        reason: 'This leave type does not accrue monthly',
      };
    }

    // Calculate accrual
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

    // Unpaid leave types (Maternity, Paternity in SA - employee claims from UIF)
    if (!config.isPaid) {
      return {
        deductionType: 'FULL',
        leaveDays: input.leaveDays,
        dailyRate,
        deductionAmount: dailyRate * input.leaveDays,
        paidAmount: 0,
        paidPercentage: 0,
        notes:
          config.code === 'MATERNITY' || config.code === 'PATERNITY'
            ? 'Employee may claim from UIF'
            : undefined,
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

    for (const balance of input.leaveBalances) {
      const config = this.getLeaveTypes().find((lt) => lt.code === balance.leaveTypeCode);
      if (!config) continue;

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

    // Check qualifying period
    const monthsEmployed = this.getMonthsBetween(input.employee.hireDate, input.startDate);
    if (monthsEmployed < config.qualifyingMonths) {
      errors.push(
        `Employee must complete ${config.qualifyingMonths} months before taking ${config.name}`,
      );
    }

    // Check available balance
    const availableBalance = input.currentBalance - input.pendingDays;
    if (input.totalDays > availableBalance && !config.allowNegativeBalance) {
      errors.push(
        `Insufficient balance. Available: ${availableBalance} days, Requested: ${input.totalDays} days`,
      );
    }

    // Check negative balance limit
    if (config.allowNegativeBalance && config.maxNegativeDays) {
      const resultingBalance = availableBalance - input.totalDays;
      if (resultingBalance < -config.maxNegativeDays) {
        errors.push(`Cannot exceed negative balance of ${config.maxNegativeDays} days`);
      }
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
          `${config.name} requires ${config.minNoticeDays} days notice. Consider this for approval.`,
        );
      }
    }

    // Determine if certificate is required
    let requiresCertificate = config.requiresCertificate;
    if (config.certificateAfterDays && input.totalDays > config.certificateAfterDays) {
      requiresCertificate = true;
    }

    // Estimate deduction
    let estimatedDeduction = 0;
    if (!config.isPaid) {
      const dailyRate = this.calculateDailyRate(input.employee.monthlySalary);
      estimatedDeduction = dailyRate * input.totalDays;
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

    // Normalize public holidays to date strings for comparison
    const holidayDates = new Set(
      input.publicHolidays.map((h) => h.toISOString().split('T')[0]),
    );

    while (currentDate <= endDate) {
      totalCalendarDays++;
      const dayOfWeek = currentDate.getDay();
      const dateString = currentDate.toISOString().split('T')[0];

      // Check if weekend
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        weekends++;
      } else if (input.excludePublicHolidays && holidayDates.has(dateString)) {
        publicHolidaysExcluded++;
      } else {
        totalWorkingDays++;
      }

      currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
    }

    // Apply half-day adjustments
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
    const config = this.getLeaveTypes().find((lt) => lt.code === leaveTypeCode);
    if (!config) {
      // Default to calendar year
      const year = referenceDate.getFullYear();
      return {
        startDate: new Date(year, 0, 1),
        endDate: new Date(year, 11, 31),
      };
    }

    const year = referenceDate.getFullYear();

    switch (config.cycleType) {
      case 'CALENDAR_YEAR':
        return {
          startDate: new Date(year, 0, 1),
          endDate: new Date(year, 11, 31),
        };

      case 'ANNIVERSARY':
        // Cycle based on hire date anniversary
        const hireMonth = hireDate.getMonth();
        const hireDay = hireDate.getDate();

        let cycleStartYear = year;
        const anniversaryThisYear = new Date(year, hireMonth, hireDay);

        if (referenceDate < anniversaryThisYear) {
          cycleStartYear = year - 1;
        }

        return {
          startDate: new Date(cycleStartYear, hireMonth, hireDay),
          endDate: new Date(cycleStartYear + 1, hireMonth, hireDay - 1),
        };

      case 'SICK_CYCLE':
        // 3-year cycle from hire date for sick leave
        const yearsEmployed = this.getMonthsBetween(hireDate, referenceDate) / 12;
        const cycleNumber = Math.floor(yearsEmployed / 3);
        const cycleStart = new Date(hireDate);
        cycleStart.setFullYear(hireDate.getFullYear() + cycleNumber * 3);

        const cycleEnd = new Date(cycleStart);
        cycleEnd.setFullYear(cycleStart.getFullYear() + 3);
        cycleEnd.setDate(cycleEnd.getDate() - 1);

        return {
          startDate: cycleStart,
          endDate: cycleEnd,
        };

      default:
        return {
          startDate: new Date(year, 0, 1),
          endDate: new Date(year, 11, 31),
        };
    }
  }

  calculateDailyRate(monthlySalary: Decimal): number {
    return Number(monthlySalary) / this.WORKING_DAYS_PER_MONTH;
  }

  // Helper: Calculate Easter date using Anonymous Gregorian algorithm
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
