import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { LoanTypesService } from './loan-types.service';

export interface ActiveLoan {
  id: string;
  loan_number: string;
  application_id: string;
  employee_id: string;
  loan_type_id: string;
  principal_amount: number;
  interest_rate: number;
  tenure_months: number;
  monthly_deduction: number;
  total_repayment: number;
  total_paid: number;
  outstanding_balance: number;
  status: string;
}

export interface LoanSchedule {
  id: string;
  loan_id: string;
  installment_number: number;
  due_date: string;
  principal_amount: number;
  interest_amount: number;
  total_amount: number;
  status: string;
}

export interface LoanRepayment {
  id: string;
  loan_id: string;
  payment_date: string;
  payment_amount: number;
  status: string;
}

@Injectable()
export class LoanRepaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loanTypesService: LoanTypesService
  ) { }

  private async generateLoanNumber(): Promise<string> {
    const lastLoan = await (this.prisma as any).activeLoan.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { loanNumber: true },
    });

    if (!lastLoan) return 'LOAN-2024-0001';

    const match = lastLoan.loanNumber?.match(/LOAN-(\d{4})-(\d{4})/);
    if (match) {
      const year = parseInt(match[1]);
      const seq = parseInt(match[2]);
      const currentYear = new Date().getFullYear();
      if (year === currentYear) {
        return `LOAN-${currentYear}-${String(seq + 1).padStart(4, '0')}`;
      }
    }

    return `LOAN-${new Date().getFullYear()}-0001`;
  }

  async disburse(
    applicationId: string,
    disbursementDate: string,
    firstDeductionDate: string,
    disbursedBy: string
  ): Promise<ActiveLoan> {
    const application = await (this.prisma as any).loanApplication.findUnique({
      where: { id: applicationId },
    });

    if (!application) throw new Error('Application not found');
    if (application.status !== 'approved') throw new Error('Only approved applications can be disbursed');

    const loanType = await this.loanTypesService.findById(application.loanTypeId);
    if (!loanType) throw new Error('Loan type not found');

    const loanNumber = await this.generateLoanNumber();
    const principalAmount = application.approvedAmount || application.requestedAmount;
    const monthlyDeduction = application.monthlyDeduction;
    const totalRepayment = application.totalRepayment;

    const firstDeduction = new Date(firstDeductionDate);
    const expectedCompletion = new Date(firstDeduction);
    expectedCompletion.setMonth(expectedCompletion.getMonth() + application.tenureMonths);

    const loan = await (this.prisma as any).activeLoan.create({
      data: {
        loanNumber,
        applicationId,
        employeeId: application.employeeId,
        loanTypeId: application.loanTypeId,
        principalAmount,
        interestRate: application.interestRate,
        tenureMonths: application.tenureMonths,
        monthlyDeduction,
        totalRepayment,
        outstandingBalance: totalRepayment,
        totalPaid: 0,
        principalPaid: 0,
        interestPaid: 0,
        disbursementDate: new Date(disbursementDate),
        firstDeductionDate: new Date(firstDeductionDate),
        expectedCompletionDate: expectedCompletion,
        status: 'active',
      },
    });

    // Generate schedule
    await this.generateSchedule(loan.id, loanType.interest_type, {
      principal_amount: principalAmount,
      interest_rate: application.interestRate,
      tenure_months: application.tenureMonths,
      monthly_deduction: monthlyDeduction,
      first_deduction_date: firstDeductionDate,
    });

    // Update application
    await (this.prisma as any).loanApplication.update({
      where: { id: applicationId },
      data: { status: 'disbursed', disbursementDate: new Date(disbursementDate) },
    });

    // Log history
    await (this.prisma as any).loanHistory.create({
      data: {
        applicationId,
        loanId: loan.id,
        action: 'disbursed',
        oldStatus: 'approved',
        newStatus: 'disbursed',
        description: `Loan disbursed: ${loanNumber}`,
        changedBy: disbursedBy,
        metadata: { loan_number: loanNumber, principal_amount: principalAmount },
      },
    });

    return this.formatLoan(loan);
  }

  private async generateSchedule(
    loanId: string,
    interestType: string,
    details: {
      principal_amount: number;
      interest_rate: number;
      tenure_months: number;
      monthly_deduction: number;
      first_deduction_date: string;
    }
  ): Promise<void> {
    let remainingPrincipal = details.principal_amount;
    const monthlyRate = details.interest_rate / (12 * 100);

    for (let i = 1; i <= details.tenure_months; i++) {
      const dueDate = new Date(details.first_deduction_date);
      dueDate.setMonth(dueDate.getMonth() + (i - 1));

      let principalPortion: number;
      let interestPortion: number;
      let totalAmount: number;

      if (interestType === 'none') {
        principalPortion = details.principal_amount / details.tenure_months;
        interestPortion = 0;
        totalAmount = principalPortion;
      } else if (interestType === 'flat') {
        const totalInterest = (details.principal_amount * details.interest_rate * details.tenure_months) / (12 * 100);
        principalPortion = details.principal_amount / details.tenure_months;
        interestPortion = totalInterest / details.tenure_months;
        totalAmount = principalPortion + interestPortion;
      } else {
        interestPortion = remainingPrincipal * monthlyRate;
        principalPortion = details.monthly_deduction - interestPortion;
        totalAmount = details.monthly_deduction;
        remainingPrincipal -= principalPortion;
      }

      await (this.prisma as any).loanSchedule.create({
        data: {
          loanId,
          installmentNumber: i,
          dueDate,
          principalAmount: Math.round(principalPortion * 100) / 100,
          interestAmount: Math.round(interestPortion * 100) / 100,
          totalAmount: Math.round(totalAmount * 100) / 100,
          paidAmount: 0,
          status: 'pending',
        },
      });
    }
  }

  async findAllLoans(filters?: { employee_id?: string; status?: string }): Promise<ActiveLoan[]> {
    const loans = await (this.prisma as any).activeLoan.findMany({
      where: {
        ...(filters?.employee_id && { employeeId: filters.employee_id }),
        ...(filters?.status && { status: filters.status }),
      },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeNo: true } },
        loanType: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return loans.map((l: any) => this.formatLoan(l));
  }

  async findLoanById(id: string): Promise<ActiveLoan | null> {
    const loan = await (this.prisma as any).activeLoan.findUnique({
      where: { id },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeNo: true } },
        loanType: { select: { name: true } },
      },
    });

    return loan ? this.formatLoan(loan) : null;
  }

  async getLoanSchedule(loanId: string): Promise<LoanSchedule[]> {
    const schedules = await (this.prisma as any).loanSchedule.findMany({
      where: { loanId },
      orderBy: { installmentNumber: 'asc' },
    });

    return schedules.map((s: any) => ({
      id: s.id,
      loan_id: s.loanId,
      installment_number: s.installmentNumber,
      due_date: s.dueDate?.toISOString() || '',
      principal_amount: Number(s.principalAmount),
      interest_amount: Number(s.interestAmount),
      total_amount: Number(s.totalAmount),
      status: s.status,
    }));
  }

  async getLoanRepayments(loanId: string): Promise<LoanRepayment[]> {
    const repayments = await (this.prisma as any).loanRepayment.findMany({
      where: { loanId },
      orderBy: { paymentDate: 'desc' },
    });

    return repayments.map((r: any) => ({
      id: r.id,
      loan_id: r.loanId,
      payment_date: r.paymentDate?.toISOString() || '',
      payment_amount: Number(r.paymentAmount),
      status: r.status,
    }));
  }

  async recordRepayment(
    loanId: string,
    amount: number,
    paymentDate: string,
    payrollRunId?: string,
    processedBy?: string
  ): Promise<LoanRepayment> {
    const loan = await (this.prisma as any).activeLoan.findFirst({
      where: { id: loanId, status: 'active' },
    });

    if (!loan) throw new Error('Active loan not found');

    // Get next pending schedule
    const schedule = await (this.prisma as any).loanSchedule.findFirst({
      where: { loanId, status: 'pending' },
      orderBy: { installmentNumber: 'asc' },
    });

    let principalPortion = 0;
    let interestPortion = 0;

    if (schedule) {
      principalPortion = Math.min(amount, Number(schedule.principalAmount));
      interestPortion = Math.min(amount - principalPortion, Number(schedule.interestAmount));

      await (this.prisma as any).loanSchedule.update({
        where: { id: schedule.id },
        data: {
          paidAmount: { increment: amount },
          paidDate: new Date(paymentDate),
          status: 'paid',
        },
      });
    } else {
      principalPortion = amount;
    }

    const repayment = await (this.prisma as any).loanRepayment.create({
      data: {
        loanId,
        scheduleId: schedule?.id || null,
        paymentDate: new Date(paymentDate),
        paymentAmount: amount,
        principalPortion,
        interestPortion,
        paymentMethod: 'payroll_deduction',
        payrollRunId: payrollRunId || null,
        processedBy: processedBy || null,
        status: 'processed',
      },
    });

    const newTotalPaid = Number(loan.totalPaid) + amount;
    const newPrincipalPaid = Number(loan.principalPaid) + principalPortion;
    const newInterestPaid = Number(loan.interestPaid) + interestPortion;
    const newOutstanding = Number(loan.totalRepayment) - newTotalPaid;

    await (this.prisma as any).activeLoan.update({
      where: { id: loanId },
      data: {
        totalPaid: newTotalPaid,
        principalPaid: newPrincipalPaid,
        interestPaid: newInterestPaid,
        outstandingBalance: newOutstanding,
        ...(newOutstanding <= 0.01 && {
          status: 'completed',
          actualCompletionDate: new Date(paymentDate),
        }),
      },
    });

    return {
      id: repayment.id,
      loan_id: repayment.loanId,
      payment_date: repayment.paymentDate?.toISOString() || '',
      payment_amount: Number(repayment.paymentAmount),
      status: repayment.status,
    };
  }

  async getLoansForPayroll(payrollDate: string): Promise<Array<{
    loan_id: string;
    employee_id: string;
    deduction_amount: number;
    schedule_id: string;
  }>> {
    const schedules = await (this.prisma as any).loanSchedule.findMany({
      where: {
        status: 'pending',
        dueDate: { lte: new Date(payrollDate) },
        loan: { status: 'active' },
      },
      include: { loan: { select: { employeeId: true } } },
      orderBy: { dueDate: 'asc' },
    });

    return schedules.map((s: any) => ({
      loan_id: s.loanId,
      employee_id: s.loan.employeeId,
      deduction_amount: Number(s.totalAmount),
      schedule_id: s.id,
    }));
  }

  async getStatistics(filters?: { employee_id?: string }): Promise<any> {
    const loans = await (this.prisma as any).activeLoan.findMany({
      where: filters?.employee_id ? { employeeId: filters.employee_id } : undefined,
    });

    return {
      total_loans: loans.length,
      active_loans: loans.filter((l: any) => l.status === 'active').length,
      completed_loans: loans.filter((l: any) => l.status === 'completed').length,
      total_disbursed: loans
        .filter((l: any) => l.status === 'active')
        .reduce((sum: number, l: any) => sum + Number(l.principalAmount), 0),
      total_outstanding: loans
        .filter((l: any) => l.status === 'active')
        .reduce((sum: number, l: any) => sum + Number(l.outstandingBalance), 0),
      total_collected: loans.reduce((sum: number, l: any) => sum + Number(l.totalPaid), 0),
    };
  }

  private formatLoan(loan: any): ActiveLoan {
    return {
      id: loan.id,
      loan_number: loan.loanNumber,
      application_id: loan.applicationId,
      employee_id: loan.employeeId,
      loan_type_id: loan.loanTypeId,
      principal_amount: Number(loan.principalAmount),
      interest_rate: Number(loan.interestRate),
      tenure_months: loan.tenureMonths,
      monthly_deduction: Number(loan.monthlyDeduction),
      total_repayment: Number(loan.totalRepayment),
      total_paid: Number(loan.totalPaid || 0),
      outstanding_balance: Number(loan.outstandingBalance),
      status: loan.status,
    };
  }
}
