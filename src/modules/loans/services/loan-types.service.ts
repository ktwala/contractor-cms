import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

export interface LoanType {
  id: string;
  code: string;
  name: string;
  description?: string;
  country: string;
  currency: string;
  min_amount: number;
  max_amount: number;
  max_amount_type: string;
  max_amount_multiplier?: number;
  min_tenure_months: number;
  max_tenure_months: number;
  interest_rate: number;
  interest_type: string;
  min_service_months: number;
  max_active_loans: number;
  requires_guarantor: boolean;
  is_active: boolean;
  effective_from: string;
  effective_to?: string;
}

export interface CreateLoanTypeDto {
  code: string;
  name: string;
  description?: string;
  country: string;
  currency: string;
  min_amount: number;
  max_amount: number;
  max_amount_type?: string;
  max_amount_multiplier?: number;
  min_tenure_months: number;
  max_tenure_months: number;
  interest_rate: number;
  interest_type?: string;
  min_service_months?: number;
  max_active_loans?: number;
  requires_guarantor?: boolean;
  effective_from: string;
  created_by?: string;
}

@Injectable()
export class LoanTypesService {
  constructor(private readonly prisma: PrismaService) { }

  async findAll(filters?: { country?: string; active_only?: boolean }): Promise<LoanType[]> {
    const loanTypes = await (this.prisma as any).loanType.findMany({
      where: {
        ...(filters?.country && { country: filters.country }),
        ...(filters?.active_only && { isActive: true }),
      },
      orderBy: [{ country: 'asc' }, { name: 'asc' }],
    });

    return loanTypes.map((lt: any) => this.formatLoanType(lt));
  }

  async findById(id: string): Promise<LoanType | null> {
    const loanType = await (this.prisma as any).loanType.findUnique({
      where: { id },
    });

    return loanType ? this.formatLoanType(loanType) : null;
  }

  async findByCode(code: string): Promise<LoanType | null> {
    const loanType = await (this.prisma as any).loanType.findFirst({
      where: { code },
    });

    return loanType ? this.formatLoanType(loanType) : null;
  }

  async findAvailableForEmployee(employeeId: string, country: string): Promise<LoanType[]> {
    // Get employee details
    const employee = await (this.prisma as any).employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) throw new Error('Employee not found');

    const serviceMonths = employee.hireDate
      ? Math.floor((Date.now() - new Date(employee.hireDate).getTime()) / (1000 * 60 * 60 * 24 * 30))
      : 0;

    const activeLoanCount = await (this.prisma as any).activeLoan.count({
      where: { employeeId, status: 'active' },
    });

    const now = new Date();
    const loanTypes = await (this.prisma as any).loanType.findMany({
      where: {
        country,
        isActive: true,
        minServiceMonths: { lte: serviceMonths },
        maxActiveLoans: { gt: activeLoanCount },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: now } },
        ],
      },
      orderBy: { name: 'asc' },
    });

    return loanTypes.map((lt: any) => this.formatLoanType(lt));
  }

  async calculateMaxAmount(loanTypeId: string, employeeId: string): Promise<number> {
    const loanType = await this.findById(loanTypeId);
    if (!loanType) throw new Error('Loan type not found');

    if (loanType.max_amount_type === 'fixed') {
      return loanType.max_amount;
    }

    const employee = await (this.prisma as any).employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) throw new Error('Employee not found');

    const basicSalary = Number(employee.salary || 0);
    const multiplier = loanType.max_amount_multiplier || 1;

    if (loanType.max_amount_type === 'times_salary' || loanType.max_amount_type === 'percentage_salary') {
      const calculated = basicSalary * multiplier;
      return Math.min(calculated, loanType.max_amount);
    }

    return loanType.max_amount;
  }

  calculateRepayment(
    principal: number,
    interestRate: number,
    tenureMonths: number,
    interestType: string
  ): { monthlyDeduction: number; totalRepayment: number; totalInterest: number } {
    if (interestType === 'none') {
      return {
        monthlyDeduction: principal / tenureMonths,
        totalRepayment: principal,
        totalInterest: 0,
      };
    }

    if (interestType === 'flat') {
      const totalInterest = (principal * interestRate * tenureMonths) / (12 * 100);
      const totalRepayment = principal + totalInterest;
      const monthlyDeduction = totalRepayment / tenureMonths;

      return {
        monthlyDeduction: Math.round(monthlyDeduction * 100) / 100,
        totalRepayment: Math.round(totalRepayment * 100) / 100,
        totalInterest: Math.round(totalInterest * 100) / 100,
      };
    }

    if (interestType === 'reducing') {
      const monthlyRate = interestRate / (12 * 100);
      const monthlyDeduction =
        principal * (monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
        (Math.pow(1 + monthlyRate, tenureMonths) - 1);

      const totalRepayment = monthlyDeduction * tenureMonths;
      const totalInterest = totalRepayment - principal;

      return {
        monthlyDeduction: Math.round(monthlyDeduction * 100) / 100,
        totalRepayment: Math.round(totalRepayment * 100) / 100,
        totalInterest: Math.round(totalInterest * 100) / 100,
      };
    }

    throw new Error('Invalid interest type');
  }

  async create(data: CreateLoanTypeDto): Promise<LoanType> {
    const loanType = await (this.prisma as any).loanType.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description || null,
        country: data.country,
        currency: data.currency,
        minAmount: data.min_amount,
        maxAmount: data.max_amount,
        maxAmountType: data.max_amount_type || 'fixed',
        maxAmountMultiplier: data.max_amount_multiplier || null,
        minTenureMonths: data.min_tenure_months,
        maxTenureMonths: data.max_tenure_months,
        interestRate: data.interest_rate,
        interestType: data.interest_type || 'flat',
        minServiceMonths: data.min_service_months || 0,
        maxActiveLoans: data.max_active_loans || 1,
        requiresGuarantor: data.requires_guarantor || false,
        effectiveFrom: new Date(data.effective_from),
        createdBy: data.created_by || null,
      },
    });

    return this.formatLoanType(loanType);
  }

  async update(id: string, data: Partial<CreateLoanTypeDto>): Promise<LoanType> {
    const loanType = await (this.prisma as any).loanType.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.min_amount !== undefined && { minAmount: data.min_amount }),
        ...(data.max_amount !== undefined && { maxAmount: data.max_amount }),
        ...(data.max_amount_type !== undefined && { maxAmountType: data.max_amount_type }),
        ...(data.max_amount_multiplier !== undefined && { maxAmountMultiplier: data.max_amount_multiplier }),
        ...(data.min_tenure_months !== undefined && { minTenureMonths: data.min_tenure_months }),
        ...(data.max_tenure_months !== undefined && { maxTenureMonths: data.max_tenure_months }),
        ...(data.interest_rate !== undefined && { interestRate: data.interest_rate }),
        ...(data.interest_type !== undefined && { interestType: data.interest_type }),
        ...(data.min_service_months !== undefined && { minServiceMonths: data.min_service_months }),
        ...(data.max_active_loans !== undefined && { maxActiveLoans: data.max_active_loans }),
        ...(data.requires_guarantor !== undefined && { requiresGuarantor: data.requires_guarantor }),
      },
    });

    return this.formatLoanType(loanType);
  }

  async activate(id: string): Promise<void> {
    await (this.prisma as any).loanType.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async deactivate(id: string): Promise<void> {
    await (this.prisma as any).loanType.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async delete(id: string): Promise<void> {
    const count = await (this.prisma as any).loanApplication.count({
      where: { loanTypeId: id },
    });

    if (count > 0) {
      throw new Error('Cannot delete loan type with existing applications. Deactivate instead.');
    }

    await (this.prisma as any).loanType.delete({ where: { id } });
  }

  private formatLoanType(lt: any): LoanType {
    return {
      id: lt.id,
      code: lt.code,
      name: lt.name,
      description: lt.description,
      country: lt.country,
      currency: lt.currency,
      min_amount: Number(lt.minAmount),
      max_amount: Number(lt.maxAmount),
      max_amount_type: lt.maxAmountType,
      max_amount_multiplier: lt.maxAmountMultiplier ? Number(lt.maxAmountMultiplier) : undefined,
      min_tenure_months: lt.minTenureMonths,
      max_tenure_months: lt.maxTenureMonths,
      interest_rate: Number(lt.interestRate),
      interest_type: lt.interestType,
      min_service_months: lt.minServiceMonths,
      max_active_loans: lt.maxActiveLoans,
      requires_guarantor: lt.requiresGuarantor,
      is_active: lt.isActive,
      effective_from: lt.effectiveFrom?.toISOString() || '',
      effective_to: lt.effectiveTo?.toISOString(),
    };
  }
}
