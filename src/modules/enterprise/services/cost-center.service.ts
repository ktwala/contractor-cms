import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

export interface CostCenter {
  id: string;
  cost_center_code: string;
  cost_center_name: string;
  cost_type: string;
  gl_account?: string;
  description?: string;
}

@Injectable()
export class CostCenterService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Create a cost center
   */
  async createCostCenter(
    costCenterCode: string,
    costCenterName: string,
    legalEntityId: string,
    parentCostCenterId: string | null,
    departmentId: string | null,
    managerId: string | null,
    costType: string,
    glAccount: string | null,
    description: string | null,
    userId: string,
  ): Promise<string> {
    const costCenter = await this.prisma.costCenter.create({
      data: {
        costCenterCode,
        costCenterName,
        legalEntityId,
        parentCostCenterId,
        departmentId,
        managerId,
        costType,
        glAccount,
        description,
        createdBy: userId,
      },
    });

    return costCenter.id;
  }

  /**
   * Allocate employee to cost center
   * Note: Cost allocation table not yet implemented in Prisma schema
   */
  async allocateEmployeeToCostCenter(
    employeeId: string,
    costCenterId: string,
    allocationPercentage: number,
    effectiveFrom: string,
    effectiveTo: string | null,
    notes: string | null,
    userId: string,
  ): Promise<string> {
    // TODO: Add CostAllocation model to Prisma schema
    // For now, return a placeholder
    return 'allocation-placeholder';
  }

  /**
   * Create a budget
   * Note: Budget table not yet implemented in Prisma schema
   */
  async createBudget(
    budgetName: string,
    costCenterId: string,
    fiscalYear: number,
    budgetPeriod: 'monthly' | 'quarterly' | 'annual',
    budgetType: 'salaries' | 'benefits' | 'total_compensation' | 'headcount',
    budgetAmount: number,
    alertThresholdPercentage: number,
    userId: string,
  ): Promise<string> {
    // TODO: Add Budget model to Prisma schema
    return 'budget-placeholder';
  }

  /**
   * Calculate budget utilization for a cost center
   */
  async calculateBudgetUtilization(
    costCenterId: string,
    fiscalYear: number,
  ): Promise<any> {
    // TODO: Implement when Budget model is added
    return [];
  }

  /**
   * Get cost center report
   */
  async getCostCenterReport(costCenterId: string, period: string): Promise<any> {
    const costCenter = await this.prisma.costCenter.findUnique({
      where: { id: costCenterId },
    });

    if (!costCenter) {
      throw new NotFoundException('Cost center not found');
    }

    return {
      cost_center: {
        id: costCenter.id,
        cost_center_code: costCenter.costCenterCode,
        cost_center_name: costCenter.costCenterName,
        cost_type: costCenter.costType,
        gl_account: costCenter.glAccount,
        description: costCenter.description,
      },
      allocations: [],
      costs: {
        total_salaries: 0,
        total_benefits: 0,
        total_cost: 0,
      },
    };
  }

  /**
   * Get all cost centers for a legal entity
   */
  async getCostCenters(legalEntityId?: string): Promise<CostCenter[]> {
    const where = legalEntityId
      ? { legalEntityId, isActive: true }
      : { isActive: true };

    const costCenters = await this.prisma.costCenter.findMany({
      where,
      orderBy: { costCenterCode: 'asc' },
    });

    return costCenters.map(cc => ({
      id: cc.id,
      cost_center_code: cc.costCenterCode,
      cost_center_name: cc.costCenterName,
      cost_type: cc.costType,
      gl_account: cc.glAccount || undefined,
      description: cc.description || undefined,
    }));
  }

  /**
   * Get budget status alerts
   */
  async getBudgetAlerts(legalEntityId: string): Promise<any[]> {
    // TODO: Implement when Budget model is added
    return [];
  }

  /**
   * Update a cost center
   */
  async updateCostCenter(
    costCenterId: string,
    costCenterCode: string,
    costCenterName: string,
    costType: string,
    glAccount: string | null,
    description: string | null,
  ): Promise<void> {
    await this.prisma.costCenter.update({
      where: { id: costCenterId },
      data: {
        costCenterCode,
        costCenterName,
        costType,
        glAccount,
        description,
      },
    });
  }

  /**
   * Soft-delete a cost center (set isActive = false)
   */
  async deleteCostCenter(costCenterId: string): Promise<void> {
    await this.prisma.costCenter.update({
      where: { id: costCenterId },
      data: { isActive: false },
    });
  }
}
