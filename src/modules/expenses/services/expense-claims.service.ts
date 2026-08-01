import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { ExpenseCategoriesService } from './expense-categories.service';

export interface ExpenseClaim {
  id: string;
  claim_number: string;
  employee_id: string;
  claim_date: Date;
  submission_date?: Date;
  period_start: Date;
  period_end: Date;
  purpose?: string;
  status: string;
  total_amount: number;
  approved_amount?: number;
  currency: string;
}

export interface ExpenseItem {
  id: string;
  claim_id: string;
  category_id: string;
  expense_date: Date;
  description: string;
  amount: number;
  currency: string;
}

export interface CreateClaimDto {
  employee_id: string;
  claim_date: Date;
  period_start: Date;
  period_end: Date;
  purpose?: string;
  currency?: string;
  created_by: string;
}

export interface CreateExpenseItemDto {
  claim_id: string;
  category_id: string;
  expense_date: Date;
  description: string;
  calculation_type: string;
  amount: number;
  currency?: string;
  has_receipt?: boolean;
  notes?: string;
}

@Injectable()
export class ExpenseClaimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categoriesService: ExpenseCategoriesService
  ) { }

  async createClaim(data: CreateClaimDto): Promise<ExpenseClaim> {
    const claimNumber = await this.generateClaimNumber();

    const claim = await (this.prisma as any).expenseClaim.create({
      data: {
        claimNumber,
        employeeId: data.employee_id,
        claimDate: data.claim_date,
        periodStart: data.period_start,
        periodEnd: data.period_end,
        purpose: data.purpose || null,
        status: 'draft',
        currency: data.currency || 'ZAR',
        approvalLevel: 0,
        requiresApprovalLevels: 1,
        totalAmount: 0,
      },
    });

    await this.logHistory({
      claim_id: claim.id,
      action: 'created',
      new_status: 'draft',
      description: 'Claim created',
      changed_by: data.created_by,
    });

    return this.formatClaim(claim);
  }

  async getClaimById(id: string): Promise<ExpenseClaim | null> {
    const claim = await (this.prisma as any).expenseClaim.findUnique({
      where: { id },
    });

    return claim ? this.formatClaim(claim) : null;
  }

  async getEmployeeClaims(employeeId: string, status?: string): Promise<ExpenseClaim[]> {
    const claims = await (this.prisma as any).expenseClaim.findMany({
      where: {
        employeeId,
        ...(status && { status }),
      },
      orderBy: { createdAt: 'desc' },
    });

    return claims.map((c: any) => this.formatClaim(c));
  }

  async getAllClaims(filters?: { status?: string; from_date?: Date; to_date?: Date }): Promise<any[]> {
    const claims = await (this.prisma as any).expenseClaim.findMany({
      where: {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.from_date && { claimDate: { gte: filters.from_date } }),
        ...(filters?.to_date && { claimDate: { lte: filters.to_date } }),
      },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeNo: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return claims.map((c: any) => ({
      ...this.formatClaim(c),
      first_name: c.employee?.firstName,
      last_name: c.employee?.lastName,
      employee_number: c.employee?.employeeNo,
    }));
  }

  async getPendingApprovals(): Promise<any[]> {
    const claims = await (this.prisma as any).expenseClaim.findMany({
      where: { status: 'pending_approval' },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeNo: true } },
      },
      orderBy: { submissionDate: 'asc' },
    });

    return claims.map((c: any) => ({
      ...this.formatClaim(c),
      first_name: c.employee?.firstName,
      last_name: c.employee?.lastName,
      employee_number: c.employee?.employeeNo,
    }));
  }

  async submitClaim(claimId: string, submittedBy: string): Promise<ExpenseClaim> {
    const claim = await this.getClaimById(claimId);
    if (!claim) throw new Error('Claim not found');
    if (claim.status !== 'draft') throw new Error('Only draft claims can be submitted');
    if (claim.total_amount <= 0) throw new Error('Cannot submit claim with no expenses');

    const updated = await (this.prisma as any).expenseClaim.update({
      where: { id: claimId },
      data: {
        status: 'pending_approval',
        submissionDate: new Date(),
        submittedBy,
      },
    });

    await this.logHistory({
      claim_id: claimId,
      action: 'submitted',
      old_status: 'draft',
      new_status: 'pending_approval',
      description: 'Claim submitted for approval',
      changed_by: submittedBy,
    });

    return this.formatClaim(updated);
  }

  async approveClaim(claimId: string, approvedBy: string, approvedAmount?: number, comments?: string): Promise<ExpenseClaim> {
    const claim = await this.getClaimById(claimId);
    if (!claim) throw new Error('Claim not found');
    if (claim.status !== 'pending_approval') throw new Error('Only pending claims can be approved');

    const finalApprovedAmount = approvedAmount || claim.total_amount;

    const updated = await (this.prisma as any).expenseClaim.update({
      where: { id: claimId },
      data: {
        status: 'approved',
        approvedAmount: finalApprovedAmount,
        approvedBy,
        approvedAt: new Date(),
      },
    });

    await (this.prisma as any).expenseApproval.create({
      data: {
        claimId,
        approverId: approvedBy,
        approvalLevel: 1,
        action: 'approved',
        comments: comments || null,
        originalAmount: claim.total_amount,
        approvedAmount: finalApprovedAmount,
      },
    });

    await this.logHistory({
      claim_id: claimId,
      action: 'approved',
      old_status: 'pending_approval',
      new_status: 'approved',
      old_amount: claim.total_amount,
      new_amount: finalApprovedAmount,
      description: `Claim approved${approvedAmount && approvedAmount !== claim.total_amount ? ' with adjustments' : ''}`,
      changed_by: approvedBy,
    });

    return this.formatClaim(updated);
  }

  async rejectClaim(claimId: string, rejectedBy: string, reason: string): Promise<void> {
    const claim = await this.getClaimById(claimId);
    if (!claim) throw new Error('Claim not found');
    if (claim.status !== 'pending_approval') throw new Error('Only pending claims can be rejected');

    await (this.prisma as any).expenseClaim.update({
      where: { id: claimId },
      data: {
        status: 'rejected',
        rejectedBy,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    });

    await (this.prisma as any).expenseApproval.create({
      data: {
        claimId,
        approverId: rejectedBy,
        approvalLevel: 1,
        action: 'rejected',
        comments: reason,
        originalAmount: claim.total_amount,
      },
    });

    await this.logHistory({
      claim_id: claimId,
      action: 'rejected',
      old_status: 'pending_approval',
      new_status: 'rejected',
      description: `Claim rejected: ${reason}`,
      changed_by: rejectedBy,
    });
  }

  async cancelClaim(claimId: string, cancelledBy: string): Promise<void> {
    const claim = await this.getClaimById(claimId);
    if (!claim) throw new Error('Claim not found');

    await (this.prisma as any).expenseClaim.update({
      where: { id: claimId },
      data: { status: 'cancelled' },
    });

    await this.logHistory({
      claim_id: claimId,
      action: 'cancelled',
      old_status: claim.status,
      new_status: 'cancelled',
      description: 'Claim cancelled',
      changed_by: cancelledBy,
    });
  }

  async addExpenseItem(data: CreateExpenseItemDto): Promise<ExpenseItem> {
    const claim = await this.getClaimById(data.claim_id);
    if (!claim) throw new Error('Claim not found');
    if (claim.status !== 'draft') throw new Error('Can only add items to draft claims');

    const item = await (this.prisma as any).expenseItem.create({
      data: {
        claimId: data.claim_id,
        categoryId: data.category_id,
        expenseDate: data.expense_date,
        description: data.description,
        calculationType: data.calculation_type,
        amount: data.amount,
        currency: data.currency || 'ZAR',
        exchangeRate: 1.0,
        hasReceipt: data.has_receipt ?? false,
        isBillable: false,
        notes: data.notes || null,
      },
    });

    await this.recalculateClaimTotal(data.claim_id);

    return this.formatItem(item);
  }

  async getClaimItems(claimId: string): Promise<ExpenseItem[]> {
    const items = await (this.prisma as any).expenseItem.findMany({
      where: { claimId },
      orderBy: { expenseDate: 'desc' },
    });

    return items.map((i: any) => this.formatItem(i));
  }

  async removeExpenseItem(itemId: string, removedBy: string): Promise<void> {
    const item = await (this.prisma as any).expenseItem.findUnique({
      where: { id: itemId },
    });

    if (!item) throw new Error('Expense item not found');

    const claim = await this.getClaimById(item.claimId);
    if (!claim || claim.status !== 'draft') throw new Error('Can only remove items from draft claims');

    await (this.prisma as any).expenseItem.delete({ where: { id: itemId } });
    await this.recalculateClaimTotal(item.claimId);
  }

  async getClaimHistory(claimId: string): Promise<any[]> {
    return (this.prisma as any).expenseHistory.findMany({
      where: { claimId },
      orderBy: { changedAt: 'desc' },
    });
  }

  async getClaimStatistics(): Promise<any> {
    const claims = await (this.prisma as any).expenseClaim.findMany();

    return {
      total_claims: claims.length,
      pending_approval: claims.filter((c: any) => c.status === 'pending_approval').length,
      approved: claims.filter((c: any) => c.status === 'approved').length,
      paid: claims.filter((c: any) => c.status === 'paid').length,
      total_approved_amount: claims
        .filter((c: any) => c.status === 'approved')
        .reduce((sum: number, c: any) => sum + Number(c.approvedAmount || 0), 0),
      total_paid_amount: claims
        .filter((c: any) => c.status === 'paid')
        .reduce((sum: number, c: any) => sum + Number(c.approvedAmount || 0), 0),
    };
  }

  private async generateClaimNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');

    const count = await (this.prisma as any).expenseClaim.count({
      where: { claimNumber: { startsWith: `EXP${year}${month}` } },
    });

    return `EXP${year}${month}${String(count + 1).padStart(4, '0')}`;
  }

  private async recalculateClaimTotal(claimId: string): Promise<void> {
    const items = await (this.prisma as any).expenseItem.findMany({
      where: { claimId },
    });

    const total = items.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);

    await (this.prisma as any).expenseClaim.update({
      where: { id: claimId },
      data: { totalAmount: total },
    });
  }

  private async logHistory(data: any): Promise<void> {
    await (this.prisma as any).expenseHistory.create({
      data: {
        claimId: data.claim_id,
        action: data.action,
        oldStatus: data.old_status || null,
        newStatus: data.new_status || null,
        oldAmount: data.old_amount || null,
        newAmount: data.new_amount || null,
        description: data.description || null,
        changedBy: data.changed_by,
      },
    });
  }

  private formatClaim(claim: any): ExpenseClaim {
    return {
      id: claim.id,
      claim_number: claim.claimNumber,
      employee_id: claim.employeeId,
      claim_date: claim.claimDate,
      submission_date: claim.submissionDate,
      period_start: claim.periodStart,
      period_end: claim.periodEnd,
      purpose: claim.purpose,
      status: claim.status,
      total_amount: Number(claim.totalAmount || 0),
      approved_amount: claim.approvedAmount ? Number(claim.approvedAmount) : undefined,
      currency: claim.currency,
    };
  }

  private formatItem(item: any): ExpenseItem {
    return {
      id: item.id,
      claim_id: item.claimId,
      category_id: item.categoryId,
      expense_date: item.expenseDate,
      description: item.description,
      amount: Number(item.amount || 0),
      currency: item.currency,
    };
  }
}
