import { Injectable, NotFoundException, BadRequestException, Logger, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { OrgUnitManagerInferenceService } from '../../org-unit-manager-inference/org-unit-manager-inference.service';

export type OrgUnitDto = {
  id: string;
  legal_entity_id: string;
  code: string;
  name: string;
  parent_org_unit_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

@Injectable()
export class OrgUnitService {
  private readonly logger = new Logger(OrgUnitService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(OrgUnitManagerInferenceService)
    private readonly inferenceService?: OrgUnitManagerInferenceService,
  ) {}

  async list(legalEntityId?: string): Promise<OrgUnitDto[]> {
    const where: { legalEntityId?: string } = {};
    if (legalEntityId) where.legalEntityId = legalEntityId;

    const items = await this.prisma.orgUnit.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      include: { parentOrgUnit: { select: { id: true, name: true, code: true } } },
    });

    return items.map((u) => ({
      id: u.id,
      legal_entity_id: u.legalEntityId,
      code: u.code,
      name: u.name,
      parent_org_unit_id: u.parentOrgUnitId,
      sort_order: u.sortOrder,
      is_active: u.isActive,
      created_at: u.createdAt.toISOString(),
      parent_name: u.parentOrgUnit?.name ?? null,
    })) as OrgUnitDto[];
  }

  async getTree(legalEntityId?: string): Promise<OrgUnitDto[]> {
    const flat = await this.list(legalEntityId);
    return flat;
  }

  async create(data: {
    legal_entity_id: string;
    code: string;
    name: string;
    parent_org_unit_id?: string | null;
    manager_employee_id?: string | null;
    sort_order?: number;
  }): Promise<string> {
    const existing = await this.prisma.orgUnit.findFirst({
      where: {
        legalEntityId: data.legal_entity_id,
        code: data.code,
      },
    });
    if (existing) {
      throw new BadRequestException(`Org unit with code "${data.code}" already exists in this legal entity.`);
    }

    if (data.parent_org_unit_id) {
      const parent = await this.prisma.orgUnit.findFirst({
        where: { id: data.parent_org_unit_id, legalEntityId: data.legal_entity_id },
      });
      if (!parent) {
        throw new BadRequestException('Parent org unit not found or does not belong to this legal entity.');
      }
    }

    const maxOrder = await this.prisma.orgUnit
      .aggregate({
        where: {
          legalEntityId: data.legal_entity_id,
          ...(data.parent_org_unit_id ? { parentOrgUnitId: data.parent_org_unit_id } : { parentOrgUnitId: null }),
        },
        _max: { sortOrder: true },
      })
      .then((r) => r._max.sortOrder ?? -1);

    const created = await this.prisma.orgUnit.create({
      data: {
        legalEntityId: data.legal_entity_id,
        code: data.code,
        name: data.name,
        parentOrgUnitId: data.parent_org_unit_id ?? null,
        managerEmployeeId: data.manager_employee_id ?? null,
        sortOrder: data.sort_order ?? maxOrder + 1,
      },
    });

    if (!data.manager_employee_id) {
      this.triggerSuggestionRefresh();
    }

    return created.id;
  }

  async update(
    id: string,
    data: { code?: string; name?: string; parent_org_unit_id?: string | null; manager_employee_id?: string | null; sort_order?: number; is_active?: boolean },
  ): Promise<void> {
    const existing = await this.prisma.orgUnit.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Org unit ${id} not found.`);
    }

    if (data.code !== undefined) {
      const duplicate = await this.prisma.orgUnit.findFirst({
        where: {
          legalEntityId: existing.legalEntityId,
          code: data.code,
          id: { not: id },
        },
      });
      if (duplicate) {
        throw new BadRequestException(`Org unit with code "${data.code}" already exists in this legal entity.`);
      }
    }

    if (data.parent_org_unit_id !== undefined && data.parent_org_unit_id) {
      const parent = await this.prisma.orgUnit.findFirst({
        where: { id: data.parent_org_unit_id, legalEntityId: existing.legalEntityId },
      });
      if (!parent) {
        throw new BadRequestException('Parent org unit not found or does not belong to this legal entity.');
      }
      if (data.parent_org_unit_id === id) {
        throw new BadRequestException('Org unit cannot be its own parent.');
      }
    }

    await this.prisma.orgUnit.update({
      where: { id },
      data: {
        ...(data.code != null && { code: data.code }),
        ...(data.name != null && { name: data.name }),
        ...(data.parent_org_unit_id !== undefined && { parentOrgUnitId: data.parent_org_unit_id }),
        ...(data.manager_employee_id !== undefined && { managerEmployeeId: data.manager_employee_id }),
        ...(data.sort_order != null && { sortOrder: data.sort_order }),
        ...(data.is_active != null && { isActive: data.is_active }),
      },
    });

    if (data.manager_employee_id === null) {
      this.triggerSuggestionRefresh();
    }
  }

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.orgUnit.findUnique({
      where: { id },
      include: { childOrgUnits: true },
    });
    if (!existing) {
      throw new NotFoundException(`Org unit ${id} not found.`);
    }
    if (existing.childOrgUnits.length > 0) {
      throw new BadRequestException('Cannot delete org unit with children. Move or delete children first.');
    }

    await this.prisma.orgUnit.delete({ where: { id } });
    this.triggerSuggestionRefresh();
  }

  private triggerSuggestionRefresh(): void {
    if (!this.inferenceService) return;
    this.inferenceService.generateSuggestions().catch((err) => {
      this.logger.warn(`Background suggestion generation failed: ${err.message}`);
    });
  }

  /** Returns breadcrumb path: e.g. ["Finance", "Payroll", "Payroll Operations"] */
  async getPath(orgUnitId: string): Promise<string[]> {
    const path: string[] = [];
    let current: { id: string; name: string; parentOrgUnitId: string | null } | null = await this.prisma.orgUnit
      .findUnique({
        where: { id: orgUnitId },
        select: { id: true, name: true, parentOrgUnitId: true },
      })
      .then((u) => u);
    while (current) {
      path.unshift(current.name);
      if (!current.parentOrgUnitId) break;
      current = await this.prisma.orgUnit
        .findUnique({
          where: { id: current.parentOrgUnitId },
          select: { id: true, name: true, parentOrgUnitId: true },
        })
        .then((u) => u);
    }
    return path;
  }
}
