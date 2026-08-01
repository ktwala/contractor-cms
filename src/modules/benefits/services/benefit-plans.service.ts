import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

export interface BenefitPlanDto {
  name: string;
  benefitType: string;
  providerName?: string;
  providerCode?: string;
  description?: string;
  isStatutory?: boolean;
  allowsDependents?: boolean;
  requiresApproval?: boolean;
  taxTreatment?: string;
  effectiveDate: Date;
  endDate?: Date;
  createdBy?: string;
}

export interface BenefitPlanOptionDto {
  planId: string;
  optionName: string;
  optionCode?: string;
  coverageLevel: string;
  description?: string;
}

export interface BenefitRateDto {
  planId: string;
  optionId?: string;
  rateType: string;
  employeeAmount?: number;
  employerAmount?: number;
  employeePercentage?: number;
  employerPercentage?: number;
  minIncome?: number;
  maxIncome?: number;
  minAge?: number;
  maxAge?: number;
  familySize?: number;
  monthlyCap?: number;
  annualCap?: number;
  effectiveDate: Date;
  endDate?: Date;
}

@Injectable()
export class BenefitPlansService {
  constructor(private readonly prisma: PrismaService) { }

  async createPlan(data: BenefitPlanDto): Promise<any> {
    return this.prisma.benefitPlan.create({
      data: {
        name: data.name,
        benefitType: data.benefitType,
        providerName: data.providerName,
        providerCode: data.providerCode,
        description: data.description,
        isStatutory: data.isStatutory ?? false,
        allowsDependents: data.allowsDependents ?? false,
        requiresApproval: data.requiresApproval ?? true,
        taxTreatment: data.taxTreatment ?? 'taxable',
        effectiveDate: data.effectiveDate,
        endDate: data.endDate,
        createdBy: data.createdBy,
      },
    });
  }

  async getPlanById(id: string): Promise<any | null> {
    return this.prisma.benefitPlan.findUnique({
      where: { id },
    });
  }

  async getAllPlans(filters?: {
    benefitType?: string;
    isActive?: boolean;
    isStatutory?: boolean;
    providerName?: string;
  }): Promise<any[]> {
    const where: any = {};

    if (filters?.benefitType) {
      where.benefitType = filters.benefitType;
    }
    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }
    if (filters?.isStatutory !== undefined) {
      where.isStatutory = filters.isStatutory;
    }
    if (filters?.providerName) {
      where.providerName = { contains: filters.providerName, mode: 'insensitive' };
    }

    return this.prisma.benefitPlan.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async updatePlan(id: string, updates: Partial<BenefitPlanDto>): Promise<any> {
    return this.prisma.benefitPlan.update({
      where: { id },
      data: updates,
    });
  }

  async deactivatePlan(id: string): Promise<void> {
    await this.prisma.benefitPlan.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async activatePlan(id: string): Promise<void> {
    await this.prisma.benefitPlan.update({
      where: { id },
      data: { isActive: true },
    });
  }

  // Plan Options
  async createPlanOption(data: BenefitPlanOptionDto): Promise<any> {
    return this.prisma.benefitPlanOption.create({
      data: {
        planId: data.planId,
        optionName: data.optionName,
        optionCode: data.optionCode,
        coverageLevel: data.coverageLevel,
        description: data.description,
      },
    });
  }

  async getPlanOptionById(id: string): Promise<any | null> {
    return this.prisma.benefitPlanOption.findUnique({
      where: { id },
    });
  }

  async getPlanOptions(planId: string, activeOnly: boolean = true): Promise<any[]> {
    const where: any = { planId };
    if (activeOnly) {
      where.isActive = true;
    }

    return this.prisma.benefitPlanOption.findMany({
      where,
      orderBy: { optionName: 'asc' },
    });
  }

  // Rates
  async createRate(data: BenefitRateDto): Promise<any> {
    return this.prisma.benefitRate.create({
      data: {
        planId: data.planId,
        optionId: data.optionId,
        rateType: data.rateType,
        employeeAmount: data.employeeAmount,
        employerAmount: data.employerAmount,
        employeePercentage: data.employeePercentage,
        employerPercentage: data.employerPercentage,
        minIncome: data.minIncome,
        maxIncome: data.maxIncome,
        minAge: data.minAge,
        maxAge: data.maxAge,
        familySize: data.familySize,
        monthlyCap: data.monthlyCap,
        annualCap: data.annualCap,
        effectiveDate: data.effectiveDate,
        endDate: data.endDate,
      },
    });
  }

  async getRateById(id: string): Promise<any | null> {
    return this.prisma.benefitRate.findUnique({
      where: { id },
    });
  }

  async getCurrentRates(planId: string, optionId?: string): Promise<any[]> {
    const today = new Date();
    const where: any = {
      planId,
      effectiveDate: { lte: today },
      OR: [
        { endDate: null },
        { endDate: { gte: today } },
      ],
    };

    if (optionId) {
      where.optionId = optionId;
    }

    return this.prisma.benefitRate.findMany({
      where,
      orderBy: { effectiveDate: 'desc' },
    });
  }

  async getPlanWithOptionsAndRates(planId: string): Promise<any | null> {
    return this.prisma.benefitPlan.findUnique({
      where: { id: planId },
      include: {
        options: {
          where: { isActive: true },
          orderBy: { optionName: 'asc' },
        },
        rates: {
          orderBy: { effectiveDate: 'desc' },
        },
      },
    });
  }

  async validatePlanExists(planId: string): Promise<boolean> {
    const plan = await this.prisma.benefitPlan.findUnique({
      where: { id: planId },
      select: { id: true },
    });
    return !!plan;
  }

  async validateOptionExists(optionId: string): Promise<boolean> {
    const option = await this.prisma.benefitPlanOption.findUnique({
      where: { id: optionId },
      select: { id: true },
    });
    return !!option;
  }
}
