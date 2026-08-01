import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { normalizeRecruitmentApplicationStages } from '../utils/recruitment-application-stages.util';

export type LookupRow = Record<string, unknown>;

@Injectable()
export class RecruitmentLookupService {
  constructor(private readonly prisma: PrismaService) {}

  /** Map common stage aliases to Prisma `job_applications.stage` values. */
  normalizeStages(stageParam?: string): string[] | undefined {
    return normalizeRecruitmentApplicationStages(stageParam);
  }

  async searchUsers(search: string | undefined, legalEntityId: string | undefined, limit = 40): Promise<LookupRow[]> {
    const q = search?.trim() ?? '';
    const parts: Prisma.UserWhereInput[] = [{ isActive: true }];
    if (legalEntityId?.trim()) {
      const le = legalEntityId.trim();
      parts.push({
        OR: [
          { legalEntityAccess: { some: { legalEntityId: le } } },
          { roleAssignments: { some: { legalEntityId: le } } },
        ],
      });
    }
    if (q) {
      parts.push({
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
        ],
      });
    }
    const rows = await this.prisma.user.findMany({
      where: { AND: parts },
      select: { id: true, email: true, firstName: true, lastName: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: limit,
    });
    return rows.map((u) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`.trim() || u.email,
      email: u.email,
    }));
  }

  async listApplicationOptions(params: {
    legalEntityId: string;
    search?: string;
    candidateId?: string;
    stages?: string[];
  }): Promise<LookupRow[]> {
    const le = params.legalEntityId.trim();
    const q = params.search?.trim() ?? '';

    const where: Prisma.JobApplicationWhereInput = {
      requisition: { legalEntityId: le },
      status: { not: 'rejected' },
    };
    if (params.candidateId?.trim()) {
      where.candidateId = params.candidateId.trim();
    }
    if (params.stages?.length) {
      where.stage = { in: params.stages };
    }
    if (q) {
      where.AND = [
        {
          OR: [
            { candidate: { firstName: { contains: q, mode: 'insensitive' } } },
            { candidate: { lastName: { contains: q, mode: 'insensitive' } } },
            { candidate: { email: { contains: q, mode: 'insensitive' } } },
            { requisition: { title: { contains: q, mode: 'insensitive' } } },
          ],
        },
      ];
    }

    const apps = await this.prisma.jobApplication.findMany({
      where,
      include: {
        candidate: { select: { id: true, firstName: true, lastName: true, email: true } },
        requisition: { select: { title: true } },
      },
      orderBy: { applicationDate: 'desc' },
      take: 50,
    });

    return apps.map((app) => {
      const cn = `${app.candidate.firstName} ${app.candidate.lastName}`.trim();
      return {
        id: app.id,
        candidate_id: app.candidateId,
        candidate_name: cn || app.candidate.email,
        requisition_title: app.requisition.title,
        stage: app.stage,
      };
    });
  }

  async listRequisitionOptions(params: {
    legalEntityId: string;
    search?: string;
    onlyOpen?: boolean;
  }): Promise<LookupRow[]> {
    const le = params.legalEntityId.trim();
    const q = params.search?.trim() ?? '';
    const where: Prisma.JobRequisitionWhereInput = {
      legalEntityId: le,
      ...(params.onlyOpen ? { status: 'open' } : {}),
      ...(q
        ? {
            title: { contains: q, mode: 'insensitive' },
          }
        : {}),
    };
    const rows = await this.prisma.jobRequisition.findMany({
      where,
      select: { id: true, title: true, department: true, status: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      department: r.department,
      status: r.status,
    }));
  }

  async listWorkLocationOptions(legalEntityId: string, search?: string): Promise<LookupRow[]> {
    const le = legalEntityId.trim();
    const q = search?.trim() ?? '';
    const where: Prisma.WorkLocationWhereInput = {
      legalEntityId: le,
      isActive: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { code: { contains: q, mode: 'insensitive' } },
              { city: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const rows = await this.prisma.workLocation.findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        city: true,
        countryCode: true,
        isRemote: true,
        isHybrid: true,
      },
      orderBy: [{ code: 'asc' }],
      take: 50,
    });
    return rows.map((loc) => ({
      id: loc.id,
      name: loc.name,
      code: loc.code,
      city: loc.city,
      country_code: loc.countryCode,
      is_remote: loc.isRemote,
      is_hybrid: loc.isHybrid,
    }));
  }

  async listOrgUnitOptions(legalEntityId: string, search?: string): Promise<LookupRow[]> {
    const le = legalEntityId.trim();
    const q = search?.trim() ?? '';
    const where: Prisma.OrgUnitWhereInput = {
      legalEntityId: le,
      isActive: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { code: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const rows = await this.prisma.orgUnit.findMany({
      where,
      select: { id: true, name: true, code: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      take: 50,
    });
    return rows.map((o) => ({
      id: o.id,
      name: o.name,
      code: o.code,
    }));
  }

  async listEmployeeOptions(legalEntityId: string, search?: string): Promise<LookupRow[]> {
    const le = legalEntityId.trim();
    const q = search?.trim() ?? '';
    const where: Prisma.EmployeeWhereInput = {
      legalEntityId: le,
      status: 'ACTIVE',
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { employeeNo: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const rows = await this.prisma.employee.findMany({
      where,
      select: { id: true, firstName: true, lastName: true, email: true, employeeNo: true, jobTitle: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 50,
    });
    return rows.map((e) => ({
      id: e.id,
      name: `${e.firstName} ${e.lastName}`.trim(),
      email: e.email,
      employee_number: e.employeeNo,
      job_title: e.jobTitle,
    }));
  }

  async listOfferOptions(params: {
    legalEntityId?: string;
    search?: string;
    acceptedOnly?: boolean;
  }): Promise<LookupRow[]> {
    const q = params.search?.trim() ?? '';
    const where: Prisma.JobOfferWhereInput = {};

    if (params.acceptedOnly) {
      where.status = 'accepted';
    }

    if (params.legalEntityId?.trim()) {
      where.requisition = { legalEntityId: params.legalEntityId.trim() };
    }

    if (q) {
      where.AND = [
        {
          OR: [
            { candidate: { firstName: { contains: q, mode: 'insensitive' } } },
            { candidate: { lastName: { contains: q, mode: 'insensitive' } } },
            { candidate: { email: { contains: q, mode: 'insensitive' } } },
            { requisition: { title: { contains: q, mode: 'insensitive' } } },
          ],
        },
      ];
    }

    const offers = await this.prisma.jobOffer.findMany({
      where,
      include: {
        candidate: { select: { firstName: true, lastName: true, email: true } },
        requisition: { select: { title: true, department: true, hiringManagerId: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    const managerIds = [
      ...new Set(
        offers
          .map((o) => o.requisition.hiringManagerId)
          .filter((id): id is string => Boolean(id?.trim())),
      ),
    ];
    const managers =
      managerIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: managerIds } },
            select: { id: true, firstName: true, lastName: true, email: true },
          })
        : [];
    const managerNameById = new Map(
      managers.map((u) => {
        const n = `${u.firstName} ${u.lastName}`.trim();
        return [u.id, n || u.email] as const;
      }),
    );

    return offers.map((o) => {
      const cn = `${o.candidate.firstName} ${o.candidate.lastName}`.trim();
      const hmId = o.requisition.hiringManagerId;
      const dept = o.department ?? o.requisition.department ?? null;
      return {
        id: o.id,
        candidate_name: cn || o.candidate.email,
        requisition_title: o.requisition.title,
        position: o.position,
        department: dept,
        hiring_manager_name: hmId ? managerNameById.get(hmId) ?? null : null,
        status: o.status,
      };
    });
  }
}
