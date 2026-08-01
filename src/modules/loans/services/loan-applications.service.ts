import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { LoanTypesService } from './loan-types.service';

export interface LoanApplication {
  id: string;
  application_number: string;
  employee_id: string;
  loan_type_id: string;
  requested_amount: number;
  approved_amount?: number;
  tenure_months: number;
  purpose?: string;
  interest_rate: number;
  monthly_deduction?: number;
  total_repayment?: number;
  status: string;
  employee_name?: string;
  loan_type_name?: string;
}

export interface CreateLoanApplicationDto {
  employee_id: string;
  loan_type_id: string;
  requested_amount: number;
  tenure_months: number;
  purpose?: string;
  guarantor_employee_id?: string;
  application_date?: string;
}

@Injectable()
export class LoanApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loanTypesService: LoanTypesService
  ) { }

  private async generateApplicationNumber(): Promise<string> {
    const lastApp = await (this.prisma as any).loanApplication.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { applicationNumber: true },
    });

    if (!lastApp) return 'LN-2024-0001';

    const match = lastApp.applicationNumber?.match(/LN-(\d{4})-(\d{4})/);
    if (match) {
      const year = parseInt(match[1]);
      const seq = parseInt(match[2]);
      const currentYear = new Date().getFullYear();
      if (year === currentYear) {
        return `LN-${currentYear}-${String(seq + 1).padStart(4, '0')}`;
      }
    }

    return `LN-${new Date().getFullYear()}-0001`;
  }

  async findAll(filters?: { employee_id?: string; status?: string; loan_type_id?: string }): Promise<LoanApplication[]> {
    const applications = await (this.prisma as any).loanApplication.findMany({
      where: {
        ...(filters?.employee_id && { employeeId: filters.employee_id }),
        ...(filters?.status && { status: filters.status }),
        ...(filters?.loan_type_id && { loanTypeId: filters.loan_type_id }),
      },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeNo: true } },
        loanType: { select: { name: true } },
        guarantor: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return applications.map((app: any) => this.formatApplication(app));
  }

  async findById(id: string): Promise<LoanApplication | null> {
    const app = await (this.prisma as any).loanApplication.findUnique({
      where: { id },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeNo: true } },
        loanType: { select: { name: true } },
        guarantor: { select: { firstName: true, lastName: true } },
      },
    });

    return app ? this.formatApplication(app) : null;
  }

  async create(data: CreateLoanApplicationDto): Promise<LoanApplication> {
    const loanType = await this.loanTypesService.findById(data.loan_type_id);
    if (!loanType || !loanType.is_active) throw new Error('Invalid or inactive loan type');

    const maxAmount = await this.loanTypesService.calculateMaxAmount(data.loan_type_id, data.employee_id);

    if (data.requested_amount < loanType.min_amount) {
      throw new Error(`Minimum loan amount is ${loanType.currency} ${loanType.min_amount}`);
    }

    if (data.requested_amount > maxAmount) {
      throw new Error(`Maximum loan amount is ${loanType.currency} ${maxAmount}`);
    }

    if (data.tenure_months < loanType.min_tenure_months || data.tenure_months > loanType.max_tenure_months) {
      throw new Error(`Tenure must be between ${loanType.min_tenure_months} and ${loanType.max_tenure_months} months`);
    }

    const activeLoanCount = await (this.prisma as any).activeLoan.count({
      where: { employeeId: data.employee_id, status: 'active' },
    });

    if (activeLoanCount >= loanType.max_active_loans) {
      throw new Error(`You have reached the maximum of ${loanType.max_active_loans} active loan(s)`);
    }

    const repayment = this.loanTypesService.calculateRepayment(
      data.requested_amount,
      loanType.interest_rate,
      data.tenure_months,
      loanType.interest_type
    );

    const applicationNumber = await this.generateApplicationNumber();
    const applicationDate = data.application_date || new Date().toISOString().split('T')[0];

    const application = await (this.prisma as any).loanApplication.create({
      data: {
        applicationNumber,
        employeeId: data.employee_id,
        loanTypeId: data.loan_type_id,
        requestedAmount: data.requested_amount,
        tenureMonths: data.tenure_months,
        purpose: data.purpose || null,
        interestRate: loanType.interest_rate,
        monthlyDeduction: repayment.monthlyDeduction,
        totalRepayment: repayment.totalRepayment,
        applicationDate: new Date(applicationDate),
        status: 'draft',
        guarantorEmployeeId: data.guarantor_employee_id || null,
      },
    });

    // Log history
    await (this.prisma as any).loanHistory.create({
      data: {
        applicationId: application.id,
        action: 'created',
        newStatus: 'draft',
        description: 'Loan application created',
        changedBy: data.employee_id,
      },
    });

    return this.formatApplication(application);
  }

  async submit(id: string, submittedBy: string): Promise<LoanApplication> {
    const app = await (this.prisma as any).loanApplication.findUnique({ where: { id } });
    if (!app) throw new Error('Application not found');
    if (app.status !== 'draft') throw new Error('Only draft applications can be submitted');

    const loanType = await this.loanTypesService.findById(app.loanTypeId);
    if (loanType?.requires_guarantor && !app.guarantorEmployeeId) {
      throw new Error('Guarantor is required for this loan type');
    }

    const updated = await (this.prisma as any).loanApplication.update({
      where: { id },
      data: {
        status: 'pending_approval',
        submissionDate: new Date(),
        submittedBy,
      },
    });

    await (this.prisma as any).loanHistory.create({
      data: {
        applicationId: id,
        action: 'submitted',
        oldStatus: 'draft',
        newStatus: 'pending_approval',
        description: 'Application submitted for approval',
        changedBy: submittedBy,
      },
    });

    return this.formatApplication(updated);
  }

  async approve(id: string, approvedBy: string, approvedAmount?: number, comments?: string): Promise<LoanApplication> {
    const app = await this.findById(id);
    if (!app) throw new Error('Application not found');
    if (app.status !== 'pending_approval') throw new Error('Only pending applications can be approved');

    const finalAmount = approvedAmount || app.requested_amount;

    let monthlyDeduction = app.monthly_deduction;
    let totalRepayment = app.total_repayment;

    if (approvedAmount && approvedAmount !== app.requested_amount) {
      const loanType = await this.loanTypesService.findById(app.loan_type_id);
      if (loanType) {
        const repayment = this.loanTypesService.calculateRepayment(
          finalAmount,
          app.interest_rate,
          app.tenure_months,
          loanType.interest_type
        );
        monthlyDeduction = repayment.monthlyDeduction;
        totalRepayment = repayment.totalRepayment;
      }
    }

    const updated = await (this.prisma as any).loanApplication.update({
      where: { id },
      data: {
        status: 'approved',
        approvalDate: new Date(),
        approvedBy,
        approvedAmount: finalAmount,
        approvalComments: comments || null,
        monthlyDeduction,
        totalRepayment,
      },
    });

    await (this.prisma as any).loanApproval.create({
      data: {
        applicationId: id,
        approverId: approvedBy,
        approvalLevel: 1,
        action: 'approved',
        comments: comments || null,
        approvedAmount: finalAmount,
      },
    });

    await (this.prisma as any).loanHistory.create({
      data: {
        applicationId: id,
        action: 'approved',
        oldStatus: 'pending_approval',
        newStatus: 'approved',
        description: `Application approved${approvedAmount ? ` with amount ${finalAmount}` : ''}`,
        changedBy: approvedBy,
        metadata: { approved_amount: finalAmount, comments },
      },
    });

    return this.formatApplication(updated);
  }

  async reject(id: string, rejectedBy: string, reason: string): Promise<void> {
    const app = await this.findById(id);
    if (!app) throw new Error('Application not found');
    if (app.status !== 'pending_approval') throw new Error('Only pending applications can be rejected');

    await (this.prisma as any).loanApplication.update({
      where: { id },
      data: { status: 'rejected', rejectedBy, rejectionReason: reason },
    });

    await (this.prisma as any).loanApproval.create({
      data: {
        applicationId: id,
        approverId: rejectedBy,
        approvalLevel: 1,
        action: 'rejected',
        comments: reason,
      },
    });

    await (this.prisma as any).loanHistory.create({
      data: {
        applicationId: id,
        action: 'rejected',
        oldStatus: 'pending_approval',
        newStatus: 'rejected',
        description: 'Application rejected',
        changedBy: rejectedBy,
        metadata: { reason },
      },
    });
  }

  async cancel(id: string, cancelledBy: string): Promise<void> {
    const app = await this.findById(id);
    if (!app) throw new Error('Application not found');
    if (!['draft', 'pending_approval'].includes(app.status)) {
      throw new Error('Only draft or pending applications can be cancelled');
    }

    await (this.prisma as any).loanApplication.update({
      where: { id },
      data: { status: 'cancelled' },
    });

    await (this.prisma as any).loanHistory.create({
      data: {
        applicationId: id,
        action: 'cancelled',
        oldStatus: app.status,
        newStatus: 'cancelled',
        description: 'Application cancelled by applicant',
        changedBy: cancelledBy,
      },
    });
  }

  async getStatistics(filters?: { employee_id?: string }): Promise<any> {
    const apps = await (this.prisma as any).loanApplication.findMany({
      where: filters?.employee_id ? { employeeId: filters.employee_id } : undefined,
    });

    return {
      total_applications: apps.length,
      pending: apps.filter((a: any) => a.status === 'pending_approval').length,
      approved: apps.filter((a: any) => a.status === 'approved').length,
      rejected: apps.filter((a: any) => a.status === 'rejected').length,
      disbursed: apps.filter((a: any) => a.status === 'disbursed').length,
      total_approved_amount: apps
        .filter((a: any) => a.status === 'approved')
        .reduce((sum: number, a: any) => sum + Number(a.approvedAmount || 0), 0),
      total_pending_amount: apps
        .filter((a: any) => a.status === 'pending_approval')
        .reduce((sum: number, a: any) => sum + Number(a.requestedAmount || 0), 0),
    };
  }

  private formatApplication(app: any): LoanApplication {
    return {
      id: app.id,
      application_number: app.applicationNumber,
      employee_id: app.employeeId,
      loan_type_id: app.loanTypeId,
      requested_amount: Number(app.requestedAmount),
      approved_amount: app.approvedAmount ? Number(app.approvedAmount) : undefined,
      tenure_months: app.tenureMonths,
      purpose: app.purpose,
      interest_rate: Number(app.interestRate),
      monthly_deduction: app.monthlyDeduction ? Number(app.monthlyDeduction) : undefined,
      total_repayment: app.totalRepayment ? Number(app.totalRepayment) : undefined,
      status: app.status,
      employee_name: app.employee ? `${app.employee.firstName} ${app.employee.lastName}` : undefined,
      loan_type_name: app.loanType?.name,
    };
  }
}
