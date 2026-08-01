import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

export interface CompanyGroup {
  id: string;
  group_name: string;
  group_code: string;
  consolidation_currency: string;
}

export interface GroupMember {
  legal_entity_id: string;
  entity_name: string;
  consolidation_percentage: number;
}

export interface ConsolidatedPayroll {
  group_id: string;
  period: string;
  total_gross_pay: number;
  total_deductions: number;
  total_net_pay: number;
  total_employer_contributions: number;
  total_employee_count: number;
  by_entity: Array<{
    legal_entity_id: string;
    entity_name: string;
    gross_pay: number;
    deductions: number;
    net_pay: number;
    employee_count: number;
  }>;
}

@Injectable()
export class MultiCompanyConsolidationService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Create a company group for consolidated reporting
   */
  async createCompanyGroup(
    groupName: string,
    groupCode: string,
    consolidationCurrency: 'ZAR' | 'LSL' = 'ZAR',
    parentGroupId: string | null = null,
    userId: string,
  ): Promise<string> {
    const group = await this.prisma.companyGroup.create({
      data: {
        groupName,
        groupCode,
        consolidationCurrency,
        parentGroupId,
        createdBy: userId,
      },
    });

    return group.id;
  }

  /**
   * Add a legal entity to a company group
   */
  async addEntityToGroup(
    groupId: string,
    legalEntityId: string,
    effectiveFrom: string,
    consolidationPercentage: number = 100.0,
    effectiveTo: string | null = null,
  ): Promise<string> {
    const member = await this.prisma.companyGroupMember.create({
      data: {
        groupId,
        legalEntityId,
        effectiveFrom: new Date(effectiveFrom),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
        consolidationPercentage,
      },
    });

    return member.id;
  }

  /**
   * Get all entities in a company group
   */
  async getGroupMembers(groupId: string): Promise<GroupMember[]> {
    const members = await this.prisma.companyGroupMember.findMany({
      where: {
        groupId,
        isActive: true,
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: new Date() } },
        ],
      },
      include: {
        group: true,
      },
    });

    // Since we don't have a direct relation to LegalEntity,
    // we need to fetch them separately
    const legalEntityIds = members.map(m => m.legalEntityId);
    const legalEntities = await this.prisma.legalEntity.findMany({
      where: { id: { in: legalEntityIds } },
    });
    const leMap = new Map(legalEntities.map(le => [le.id, le]));

    return members.map(m => ({
      legal_entity_id: m.legalEntityId,
      entity_name: leMap.get(m.legalEntityId)?.name || 'Unknown',
      consolidation_percentage: Number(m.consolidationPercentage),
    }));
  }

  /**
   * Generate consolidated payroll report for a group
   */
  async getConsolidatedPayroll(
    groupId: string,
    period: string,
  ): Promise<ConsolidatedPayroll> {
    const members = await this.getGroupMembers(groupId);

    if (members.length === 0) {
      return {
        group_id: groupId,
        period,
        total_gross_pay: 0,
        total_deductions: 0,
        total_net_pay: 0,
        total_employer_contributions: 0,
        total_employee_count: 0,
        by_entity: [],
      };
    }

    // In a real implementation, we'd aggregate payroll data from EmployeeResult
    // For now, return placeholder data
    return {
      group_id: groupId,
      period,
      total_gross_pay: 0,
      total_deductions: 0,
      total_net_pay: 0,
      total_employer_contributions: 0,
      total_employee_count: 0,
      by_entity: [],
    };
  }

  /**
   * Get consolidated statutory compliance for a group
   */
  async getConsolidatedCompliance(
    groupId: string,
    period: string,
  ): Promise<any> {
    const members = await this.getGroupMembers(groupId);

    if (members.length === 0) {
      return {
        group_id: groupId,
        period,
        paye: { total: 0, by_entity: [] },
        uif: { total: 0, by_entity: [] },
        sdl: { total: 0, by_entity: [] },
      };
    }

    // Placeholder - would aggregate real compliance data
    return {
      group_id: groupId,
      period,
      paye: { total: 0, by_entity: [] },
      uif: { total: 0, by_entity: [] },
      sdl: { total: 0, by_entity: [] },
    };
  }

  /**
   * Get consolidated headcount by department/location
   */
  async getConsolidatedHeadcount(groupId: string): Promise<any> {
    const members = await this.getGroupMembers(groupId);

    if (members.length === 0) {
      return {
        group_id: groupId,
        total_headcount: 0,
        by_entity: [],
        by_department: [],
      };
    }

    const entityIds = members.map(m => m.legal_entity_id);

    // Get employee count by entity
    const employments = await this.prisma.employment.groupBy({
      by: ['legalEntityId'],
      where: {
        legalEntityId: { in: entityIds },
        effectiveTo: null,
      },
      _count: { id: true },
    });

    const legalEntities = await this.prisma.legalEntity.findMany({
      where: { id: { in: entityIds } },
    });
    const leMap = new Map(legalEntities.map(le => [le.id, le]));

    const byEntity = employments.map(e => ({
      legal_entity_id: e.legalEntityId,
      entity_name: leMap.get(e.legalEntityId)?.name || 'Unknown',
      headcount: e._count.id,
    }));

    const totalHeadcount = byEntity.reduce((sum, e) => sum + e.headcount, 0);

    return {
      group_id: groupId,
      total_headcount: totalHeadcount,
      by_entity: byEntity,
      by_department: [],
    };
  }

  /**
   * Get all company groups
   */
  async getAllGroups(): Promise<CompanyGroup[]> {
    const groups = await this.prisma.companyGroup.findMany({
      where: { isActive: true },
      orderBy: { groupName: 'asc' },
    });

    return groups.map(g => ({
      id: g.id,
      group_name: g.groupName,
      group_code: g.groupCode,
      consolidation_currency: g.consolidationCurrency,
    }));
  }

  /**
   * Update a company group
   */
  async updateCompanyGroup(
    groupId: string,
    groupName: string,
    groupCode: string,
    consolidationCurrency: 'ZAR' | 'LSL',
  ): Promise<void> {
    await this.prisma.companyGroup.update({
      where: { id: groupId },
      data: {
        groupName,
        groupCode,
        consolidationCurrency,
      },
    });
  }

  /**
   * Soft-delete a company group (set isActive = false)
   */
  async deleteCompanyGroup(groupId: string): Promise<void> {
    await this.prisma.companyGroup.update({
      where: { id: groupId },
      data: { isActive: false },
    });
  }
}
