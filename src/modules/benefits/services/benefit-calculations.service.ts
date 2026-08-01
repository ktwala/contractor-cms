import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { BenefitPlansService } from './benefit-plans.service';
import { BenefitEnrollmentsService } from './benefit-enrollments.service';

export interface CalculationResult {
  employeeDeduction: number;
  employerContribution: number;
  totalAmount: number;
  isProrated: boolean;
  prorataFactor?: number;
  calculationNotes: string;
}

@Injectable()
export class BenefitCalculationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly benefitPlansService: BenefitPlansService,
    private readonly benefitEnrollmentsService: BenefitEnrollmentsService,
  ) { }

  async calculateContribution(
    enrollment: any,
    grossSalary: number,
    workingDays: number,
    totalDaysInMonth: number,
    employeeAge?: number,
    dependentCount?: number,
  ): Promise<CalculationResult> {
    // Get current rates for the plan/option
    const rates = await this.benefitPlansService.getCurrentRates(
      enrollment.planId,
      enrollment.optionId,
    );

    if (rates.length === 0) {
      // Use custom rates from enrollment
      return {
        employeeDeduction: Number(enrollment.employeeContribution),
        employerContribution: Number(enrollment.employerContribution),
        totalAmount: Number(enrollment.totalContribution),
        isProrated: false,
        calculationNotes: 'Using custom enrollment rates',
      };
    }

    // Find applicable rate
    const applicableRate = this.findApplicableRate(rates, {
      grossSalary,
      age: employeeAge,
      dependentCount,
    });

    if (!applicableRate) {
      return {
        employeeDeduction: Number(enrollment.employeeContribution),
        employerContribution: Number(enrollment.employerContribution),
        totalAmount: Number(enrollment.totalContribution),
        isProrated: false,
        calculationNotes: 'No applicable rate found, using enrollment defaults',
      };
    }

    // Calculate based on rate type
    const calculated = this.calculateByRateType(applicableRate, grossSalary);

    // Check for proration
    const prorataFactor = workingDays / totalDaysInMonth;
    const isProrated = prorataFactor < 1;

    const employeeDeduction = isProrated ? calculated.employee * prorataFactor : calculated.employee;
    const employerContribution = isProrated ? calculated.employer * prorataFactor : calculated.employer;

    return {
      employeeDeduction: Math.round(employeeDeduction * 100) / 100,
      employerContribution: Math.round(employerContribution * 100) / 100,
      totalAmount: Math.round((employeeDeduction + employerContribution) * 100) / 100,
      isProrated,
      prorataFactor: isProrated ? prorataFactor : undefined,
      calculationNotes: `Rate type: ${applicableRate.rateType}${isProrated ? `, prorated ${(prorataFactor * 100).toFixed(1)}%` : ''}`,
    };
  }

  private findApplicableRate(rates: any[], criteria: {
    grossSalary: number;
    age?: number;
    dependentCount?: number;
  }): any | null {
    for (const rate of rates) {
      // Check income bracket
      if (rate.minIncome && criteria.grossSalary < Number(rate.minIncome)) continue;
      if (rate.maxIncome && criteria.grossSalary > Number(rate.maxIncome)) continue;

      // Check age
      if (rate.minAge && criteria.age && criteria.age < rate.minAge) continue;
      if (rate.maxAge && criteria.age && criteria.age > rate.maxAge) continue;

      // Check family size
      if (rate.familySize && criteria.dependentCount !== rate.familySize) continue;

      return rate;
    }

    // Return first rate as fallback
    return rates.length > 0 ? rates[0] : null;
  }

  private calculateByRateType(rate: any, grossSalary: number): { employee: number; employer: number } {
    const rateType = rate.rateType;

    if (rateType === 'fixed_amount') {
      return {
        employee: Number(rate.employeeAmount) || 0,
        employer: Number(rate.employerAmount) || 0,
      };
    }

    if (rateType === 'percentage_of_salary') {
      const employeePercentage = Number(rate.employeePercentage) || 0;
      const employerPercentage = Number(rate.employerPercentage) || 0;

      let employee = grossSalary * (employeePercentage / 100);
      let employer = grossSalary * (employerPercentage / 100);

      // Apply caps
      if (rate.monthlyCap) {
        employee = Math.min(employee, Number(rate.monthlyCap));
        employer = Math.min(employer, Number(rate.monthlyCap));
      }

      return { employee, employer };
    }

    // Default to fixed amounts
    return {
      employee: Number(rate.employeeAmount) || 0,
      employer: Number(rate.employerAmount) || 0,
    };
  }

  async createDeduction(
    payslipId: string,
    enrollmentId: string,
    calculation: CalculationResult,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<any> {
    return this.prisma.benefitDeduction.create({
      data: {
        enrollmentId,
        payslipId,
        periodStart,
        periodEnd,
        employeeDeduction: calculation.employeeDeduction,
        employerContribution: calculation.employerContribution,
        totalAmount: calculation.totalAmount,
        isProrated: calculation.isProrated,
        prorataFactor: calculation.prorataFactor,
        calculationNotes: calculation.calculationNotes,
      },
    });
  }

  async processPayrollBenefits(
    employeeId: string,
    payslipId: string,
    grossSalary: number,
    periodStart: Date,
    periodEnd: Date,
    workingDays: number,
    totalDaysInMonth: number,
  ): Promise<{
    deductions: any[];
    totalEmployeeDeduction: number;
    totalEmployerContribution: number;
  }> {
    // Get active enrollments
    const enrollments = await this.benefitEnrollmentsService.getEmployeeEnrollments(employeeId, true);

    const deductions: any[] = [];
    let totalEmployeeDeduction = 0;
    let totalEmployerContribution = 0;

    for (const enrollment of enrollments) {
      const calculation = await this.calculateContribution(
        enrollment,
        grossSalary,
        workingDays,
        totalDaysInMonth,
      );

      const deduction = await this.createDeduction(
        payslipId,
        enrollment.id,
        calculation,
        periodStart,
        periodEnd,
      );

      deductions.push({
        ...deduction,
        planName: enrollment.plan?.name,
        optionName: enrollment.option?.optionName,
      });

      totalEmployeeDeduction += calculation.employeeDeduction;
      totalEmployerContribution += calculation.employerContribution;
    }

    return {
      deductions,
      totalEmployeeDeduction,
      totalEmployerContribution,
    };
  }

  async getDeductionSummary(periodStart: Date, periodEnd: Date): Promise<any> {
    const deductions = await this.prisma.benefitDeduction.findMany({
      where: {
        periodStart: { gte: periodStart },
        periodEnd: { lte: periodEnd },
      },
      include: {
        enrollment: {
          include: {
            plan: true,
          },
        },
      },
    });

    // Group by plan
    const byPlan: Record<string, any> = {};

    for (const deduction of deductions) {
      const planId = deduction.enrollment.planId;
      const planName = deduction.enrollment.plan.name;

      if (!byPlan[planId]) {
        byPlan[planId] = {
          planId,
          planName,
          employeeTotal: 0,
          employerTotal: 0,
          count: 0,
        };
      }

      byPlan[planId].employeeTotal += Number(deduction.employeeDeduction);
      byPlan[planId].employerTotal += Number(deduction.employerContribution);
      byPlan[planId].count++;
    }

    return {
      byPlan: Object.values(byPlan),
      totalEmployeeDeductions: deductions.reduce((sum, d) => sum + Number(d.employeeDeduction), 0),
      totalEmployerContributions: deductions.reduce((sum, d) => sum + Number(d.employerContribution), 0),
      totalDeductions: deductions.length,
    };
  }
}
