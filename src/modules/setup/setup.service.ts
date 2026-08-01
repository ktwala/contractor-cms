import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

export interface SetupItem {
  key: string;
  label: string;
  ready: boolean;
  count: number;
  href?: string;
  optional?: boolean;
}

export interface SetupStatusResponse {
  complete: boolean;
  items: SetupItem[];
  legal_entities: number;
  org_units: number;
  cost_centers: number;
  company_groups: number;
  positions: number;
  employees: number;
  employments: number;
}

@Injectable()
export class SetupService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(): Promise<SetupStatusResponse> {
    const [legalEntities, orgUnits, costCenters, companyGroups, positions, employees, employments, withManager] =
      await Promise.all([
        this.prisma.legalEntity.count(),
        this.prisma.orgUnit.count(),
        this.prisma.costCenter.count(),
        this.prisma.companyGroup.count(),
        this.prisma.position.count(),
        this.prisma.employee.count(),
        this.prisma.employment.count(),
        this.prisma.employee.count({ where: { managerId: { not: null } } }),
      ]);

    const items: SetupItem[] = [
      {
        key: 'legal_entity',
        label: 'Legal Entities',
        ready: legalEntities > 0,
        count: legalEntities,
        href: '/enterprise/legal-entities',
      },
      {
        key: 'org_units',
        label: 'Org Structure',
        ready: orgUnits > 0,
        count: orgUnits,
        href: '/enterprise/org-structure',
      },
      {
        key: 'cost_centers',
        label: 'Cost Centers',
        ready: costCenters > 0,
        count: costCenters,
        href: '/enterprise/cost-centers',
      },
      {
        key: 'positions',
        label: 'Positions',
        ready: positions > 0,
        count: positions,
        href: '/enterprise/positions',
        optional: true,
      },
      {
        key: 'company_groups',
        label: 'Company Groups',
        ready: companyGroups > 0,
        count: companyGroups,
        href: '/enterprise/company-groups',
      },
      {
        key: 'employees',
        label: 'Employees',
        ready: employees > 0,
        count: employees,
        href: '/enterprise/employees',
      },
      {
        key: 'employments',
        label: 'Employments',
        ready: employments > 0,
        count: employments,
        href: '/enterprise/employment-assignments',
      },
      {
        key: 'manager_hierarchy',
        label: 'Manager Hierarchy',
        ready: withManager > 0,
        count: withManager,
        href: '/enterprise/manager-hierarchy',
        optional: true,
      },
    ];

    const complete = items.filter((i) => !i.optional).every((i) => i.ready);

    return {
      complete,
      items,
      legal_entities: legalEntities,
      org_units: orgUnits,
      cost_centers: costCenters,
      company_groups: companyGroups,
      positions,
      employees,
      employments,
    };
  }
}
