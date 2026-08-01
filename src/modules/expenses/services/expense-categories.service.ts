import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

export interface ExpenseCategory {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  requires_receipt: boolean;
  requires_approval: boolean;
  icon?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ExpensePolicy {
  id: string;
  category_id?: string;
  policy_type: string;
  country: string;
  currency: string;
  amount?: number;
  unit?: string;
  description?: string;
  effective_date: Date;
  end_date?: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateCategoryDto {
  name: string;
  description?: string;
  requires_receipt?: boolean;
  requires_approval?: boolean;
  icon?: string;
}

export interface CreatePolicyDto {
  category_id?: string;
  policy_type: string;
  country?: string;
  currency?: string;
  amount?: number;
  unit?: string;
  description?: string;
  effective_date: Date;
  end_date?: Date;
}

@Injectable()
export class ExpenseCategoriesService {
  constructor(private readonly prisma: PrismaService) { }

  // CATEGORIES

  async createCategory(data: CreateCategoryDto): Promise<ExpenseCategory> {
    const category = await (this.prisma as any).expenseCategory.create({
      data: {
        name: data.name,
        description: data.description || null,
        requiresReceipt: data.requires_receipt ?? true,
        requiresApproval: data.requires_approval ?? true,
        icon: data.icon || null,
        isActive: true,
      },
    });

    return this.formatCategory(category);
  }

  async getCategoryById(id: string): Promise<ExpenseCategory | null> {
    const category = await (this.prisma as any).expenseCategory.findUnique({
      where: { id },
    });

    return category ? this.formatCategory(category) : null;
  }

  async getAllCategories(activeOnly: boolean = true): Promise<ExpenseCategory[]> {
    const categories = await (this.prisma as any).expenseCategory.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { name: 'asc' },
    });

    return categories.map((c: any) => this.formatCategory(c));
  }

  async updateCategory(id: string, updates: Partial<CreateCategoryDto>): Promise<ExpenseCategory> {
    const category = await (this.prisma as any).expenseCategory.update({
      where: { id },
      data: {
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.requires_receipt !== undefined && { requiresReceipt: updates.requires_receipt }),
        ...(updates.requires_approval !== undefined && { requiresApproval: updates.requires_approval }),
        ...(updates.icon !== undefined && { icon: updates.icon }),
      },
    });

    return this.formatCategory(category);
  }

  async deactivateCategory(id: string): Promise<void> {
    await (this.prisma as any).expenseCategory.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async activateCategory(id: string): Promise<void> {
    await (this.prisma as any).expenseCategory.update({
      where: { id },
      data: { isActive: true },
    });
  }

  // POLICIES

  async createPolicy(data: CreatePolicyDto): Promise<ExpensePolicy> {
    const policy = await (this.prisma as any).expensePolicy.create({
      data: {
        categoryId: data.category_id || null,
        policyType: data.policy_type,
        country: data.country || 'ZAF',
        currency: data.currency || 'ZAR',
        amount: data.amount || null,
        unit: data.unit || null,
        description: data.description || null,
        effectiveDate: data.effective_date,
        endDate: data.end_date || null,
        isActive: true,
      },
    });

    return this.formatPolicy(policy);
  }

  async getPolicyById(id: string): Promise<ExpensePolicy | null> {
    const policy = await (this.prisma as any).expensePolicy.findUnique({
      where: { id },
    });

    return policy ? this.formatPolicy(policy) : null;
  }

  async getPolicies(filters?: {
    category_id?: string;
    policy_type?: string;
    country?: string;
    active_only?: boolean;
  }): Promise<ExpensePolicy[]> {
    const now = new Date();

    const policies = await (this.prisma as any).expensePolicy.findMany({
      where: {
        ...(filters?.category_id && { categoryId: filters.category_id }),
        ...(filters?.policy_type && { policyType: filters.policy_type }),
        ...(filters?.country && { country: filters.country }),
        ...(filters?.active_only !== false && {
          isActive: true,
          OR: [
            { endDate: null },
            { endDate: { gt: now } },
          ],
        }),
      },
      orderBy: { effectiveDate: 'desc' },
    });

    return policies.map((p: any) => this.formatPolicy(p));
  }

  async getApplicablePolicy(
    categoryId: string,
    policyType: string,
    country: string,
    date: Date = new Date()
  ): Promise<ExpensePolicy | null> {
    const policy = await (this.prisma as any).expensePolicy.findFirst({
      where: {
        categoryId,
        policyType,
        country,
        isActive: true,
        effectiveDate: { lte: date },
        OR: [
          { endDate: null },
          { endDate: { gt: date } },
        ],
      },
      orderBy: { effectiveDate: 'desc' },
    });

    return policy ? this.formatPolicy(policy) : null;
  }

  async updatePolicy(id: string, updates: Partial<CreatePolicyDto>): Promise<ExpensePolicy> {
    const policy = await (this.prisma as any).expensePolicy.update({
      where: { id },
      data: {
        ...(updates.amount !== undefined && { amount: updates.amount }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.end_date !== undefined && { endDate: updates.end_date }),
      },
    });

    return this.formatPolicy(policy);
  }

  async deactivatePolicy(id: string): Promise<void> {
    await (this.prisma as any).expensePolicy.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getMileageRate(country: string, date: Date = new Date()): Promise<number> {
    const policy = await this.getApplicablePolicy('cat-mileage', 'mileage_rate', country, date);
    return policy?.amount || 0;
  }

  async getPerDiemRate(country: string, mealType: string, date: Date = new Date()): Promise<number> {
    const policy = await (this.prisma as any).expensePolicy.findFirst({
      where: {
        categoryId: 'cat-meals',
        policyType: 'per_diem',
        country,
        unit: mealType,
        isActive: true,
        effectiveDate: { lte: date },
        OR: [
          { endDate: null },
          { endDate: { gt: date } },
        ],
      },
      orderBy: { effectiveDate: 'desc' },
    });

    return policy?.amount ? parseFloat(policy.amount) : 0;
  }

  private formatCategory(category: any): ExpenseCategory {
    return {
      id: category.id,
      name: category.name,
      description: category.description,
      is_active: category.isActive,
      requires_receipt: category.requiresReceipt,
      requires_approval: category.requiresApproval,
      icon: category.icon,
      created_at: category.createdAt,
      updated_at: category.updatedAt,
    };
  }

  private formatPolicy(policy: any): ExpensePolicy {
    return {
      id: policy.id,
      category_id: policy.categoryId,
      policy_type: policy.policyType,
      country: policy.country,
      currency: policy.currency,
      amount: policy.amount ? parseFloat(policy.amount) : undefined,
      unit: policy.unit,
      description: policy.description,
      effective_date: policy.effectiveDate,
      end_date: policy.endDate,
      is_active: policy.isActive,
      created_at: policy.createdAt,
      updated_at: policy.updatedAt,
    };
  }
}
