import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../../core/database/prisma.service';

function requisitionNumber(): string {
  return `REQ-${randomBytes(4).toString('hex').toUpperCase()}`;
}

type WorkLocationPick = {
  id: string;
  name: string;
  city: string | null;
  isRemote: boolean;
  isHybrid: boolean;
};

@Injectable()
export class JobRequisitionService {
  constructor(private readonly prisma: PrismaService) {}

  private formatWorkLocationLabel(wl: WorkLocationPick): string {
    if (wl.isRemote) return wl.name;
    const city = wl.city?.trim();
    return city ? `${wl.name} · ${city}` : wl.name;
  }

  private async resolveWorkLocationForRequisition(
    legalEntityId: string,
    workLocationId: string | null | undefined,
    fallbackLocation: string | null | undefined,
  ): Promise<{
    workLocationId: string | null;
    location: string | null;
    remoteFromSite: boolean;
    hybridFromSite: boolean;
  }> {
    const trimmedWl = workLocationId?.trim() || null;
    if (!trimmedWl) {
      return {
        workLocationId: null,
        location: fallbackLocation?.trim() || null,
        remoteFromSite: false,
        hybridFromSite: false,
      };
    }
    const wl = await this.prisma.workLocation.findFirst({
      where: { id: trimmedWl, legalEntityId, isActive: true },
      select: { id: true, name: true, city: true, isRemote: true, isHybrid: true },
    });
    if (!wl) {
      throw new BadRequestException('work_location_id not found for this legal entity');
    }
    return {
      workLocationId: wl.id,
      location: this.formatWorkLocationLabel(wl),
      remoteFromSite: wl.isRemote,
      hybridFromSite: wl.isHybrid,
    };
  }

  async createRequisition(body: Record<string, unknown>, userId: string): Promise<string> {
    const legalEntityId = body.legal_entity_id as string | undefined;
    if (!legalEntityId?.trim()) {
      throw new BadRequestException('legal_entity_id is required');
    }
    const title = (body.job_title ?? body.title) as string | undefined;
    if (!title?.trim()) {
      throw new BadRequestException('job_title (or title) is required');
    }

    const wlId = (body.work_location_id as string | undefined)?.trim() || null;
    const locFree = (body.location as string | undefined)?.trim() || null;
    const resolved = await this.resolveWorkLocationForRequisition(legalEntityId.trim(), wlId, locFree);

    let remote = Boolean(body.remote_allowed) || resolved.remoteFromSite;
    let hybrid = Boolean(body.hybrid ?? body.hybrid_work) || resolved.hybridFromSite;

    const row = await this.prisma.jobRequisition.create({
      data: {
        requisitionNumber: requisitionNumber(),
        title: title.trim(),
        legalEntityId,
        department: (body.department as string) ?? null,
        description: (body.job_description ?? body.description ?? null) as string | null,
        requirements: this.jsonOrUndefined(body.requirements),
        responsibilities: this.jsonOrUndefined(body.responsibilities),
        salaryMin: this.decimalOrNull(body.salary_range_min ?? body.salary_min),
        salaryMax: this.decimalOrNull(body.salary_range_max ?? body.salary_max),
        employmentType: (body.employment_type as string) ?? null,
        location: resolved.location,
        workLocationId: resolved.workLocationId,
        remote,
        hybrid,
        positions: Number(body.number_of_positions ?? 1) || 1,
        hiringManagerId: (body.hiring_manager_id as string) ?? null,
        createdBy: userId,
        status: 'draft',
      },
    });

    return row.id;
  }

  private jsonOrUndefined(v: unknown): Prisma.InputJsonValue | undefined {
    if (v === undefined || v === null) return undefined;
    if (typeof v === 'string') return v;
    return v as Prisma.InputJsonValue;
  }

  private decimalOrNull(v: unknown): Prisma.Decimal | null {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    if (Number.isNaN(n)) return null;
    return new Prisma.Decimal(n);
  }

  /** Approved requisitions awaiting publish */
  async approveRequisition(requisitionId: string, _userId: string): Promise<void> {
    const r = await this.prisma.jobRequisition.findUnique({ where: { id: requisitionId } });
    if (!r) throw new NotFoundException('Requisition not found');
    if (r.status !== 'draft') {
      throw new BadRequestException('Only draft requisitions can be approved');
    }
    await this.prisma.jobRequisition.update({
      where: { id: requisitionId },
      data: { status: 'on_hold' },
    });
  }

  async postRequisition(requisitionId: string): Promise<void> {
    const r = await this.prisma.jobRequisition.findUnique({ where: { id: requisitionId } });
    if (!r) throw new NotFoundException('Requisition not found');
    if (r.status !== 'on_hold') {
      throw new BadRequestException('Only approved (on_hold) requisitions can be posted');
    }
    await this.prisma.jobRequisition.update({
      where: { id: requisitionId },
      data: { status: 'open', publishedAt: new Date() },
    });
  }

  /**
   * Close a posted requisition. Accepts legacy "filled" → closed, "cancelled" → cancelled.
   */
  async closeRequisition(
    requisitionId: string,
    legacyStatus: 'filled' | 'cancelled' | 'closed',
  ): Promise<void> {
    const r = await this.prisma.jobRequisition.findUnique({ where: { id: requisitionId } });
    if (!r) throw new NotFoundException('Requisition not found');
    if (r.status !== 'open') {
      throw new BadRequestException('Only open (posted) requisitions can be closed');
    }
    const next =
      legacyStatus === 'cancelled'
        ? 'cancelled'
        : 'closed';
    await this.prisma.jobRequisition.update({
      where: { id: requisitionId },
      data: { status: next },
    });
  }

  async listRequisitions(legalEntityId: string): Promise<unknown[]> {
    const rows = await this.prisma.jobRequisition.findMany({
      where: { legalEntityId },
      include: {
        _count: { select: { applications: true } },
        workLocation: {
          select: { id: true, code: true, name: true, city: true, isRemote: true, isHybrid: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.serializeRequisition(r));
  }

  /** Active / visible requisitions for careers-style listings */
  async getOpenRequisitions(legalEntityId: string): Promise<unknown[]> {
    const rows = await this.prisma.jobRequisition.findMany({
      where: {
        legalEntityId,
        status: { in: ['open', 'on_hold'] },
      },
      include: {
        _count: { select: { applications: true } },
        workLocation: {
          select: { id: true, code: true, name: true, city: true, isRemote: true, isHybrid: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.serializeRequisition(r));
  }

  async getRequisitionDetails(requisitionId: string): Promise<unknown> {
    const r = await this.prisma.jobRequisition.findUnique({
      where: { id: requisitionId },
      include: {
        _count: { select: { applications: true } },
        workLocation: {
          select: { id: true, code: true, name: true, city: true, isRemote: true, isHybrid: true },
        },
      },
    });
    if (!r) throw new NotFoundException('Requisition not found');
    return this.serializeRequisition(r);
  }

  async updateRequisition(requisitionId: string, updates: Record<string, unknown>): Promise<void> {
    const existing = await this.prisma.jobRequisition.findUnique({
      where: { id: requisitionId },
      select: { legalEntityId: true },
    });
    if (!existing) throw new NotFoundException('Requisition not found');

    const enriched: Record<string, unknown> = { ...updates };
    if (updates.work_location_id !== undefined && existing.legalEntityId) {
      const raw = updates.work_location_id;
      const wid =
        raw === null || raw === undefined || raw === ''
          ? ''
          : String(raw).trim();
      if (!wid) {
        enriched.work_location_id = null;
      } else {
        const res = await this.resolveWorkLocationForRequisition(existing.legalEntityId, wid, null);
        enriched.work_location_id = res.workLocationId;
        enriched.location = res.location;
        if (res.remoteFromSite) enriched.remote_allowed = true;
        if (res.hybridFromSite) enriched.hybrid = true;
      }
    }

    const data: Record<string, unknown> = {};
    const map: Record<string, string> = {
      job_title: 'title',
      title: 'title',
      department: 'department',
      job_description: 'description',
      description: 'description',
      requirements: 'requirements',
      responsibilities: 'responsibilities',
      salary_range_min: 'salaryMin',
      salary_range_max: 'salaryMax',
      salary_min: 'salaryMin',
      salary_max: 'salaryMax',
      employment_type: 'employmentType',
      location: 'location',
      number_of_positions: 'positions',
      positions: 'positions',
      remote_allowed: 'remote',
      hybrid: 'hybrid',
      hybrid_work: 'hybrid',
      work_location_id: 'workLocationId',
      hiring_manager_id: 'hiringManagerId',
      status: 'status',
      closing_date: 'closingDate',
    };

    for (const [key, value] of Object.entries(enriched)) {
      const camel = key.replace(/_([a-z])/g, (_, l: string) => l.toUpperCase());
      const prismaKey = map[key] ?? map[camel] ?? camel;
      if (
        ![
          'title',
          'department',
          'description',
          'requirements',
          'responsibilities',
          'salaryMin',
          'salaryMax',
          'employmentType',
          'location',
          'positions',
          'remote',
          'hybrid',
          'workLocationId',
          'hiringManagerId',
          'status',
          'closingDate',
        ].includes(prismaKey)
      ) {
        continue;
      }
      if (prismaKey === 'requirements' || prismaKey === 'responsibilities') {
        data[prismaKey] = this.jsonOrUndefined(value);
        continue;
      }
      if (prismaKey === 'salaryMin' || prismaKey === 'salaryMax') {
        data[prismaKey] = this.decimalOrNull(value);
        continue;
      }
      if (prismaKey === 'closingDate' && value) {
        data[prismaKey] = new Date(String(value));
        continue;
      }
      if (prismaKey === 'remote' || prismaKey === 'hybrid') {
        data[prismaKey] = Boolean(value);
        continue;
      }
      if (prismaKey === 'workLocationId') {
        data[prismaKey] = value === null || value === '' ? null : value;
        continue;
      }
      if (prismaKey === 'positions') {
        data[prismaKey] = Number(value) || 1;
        continue;
      }
      data[prismaKey] = value;
    }

    if (Object.keys(data).length === 0) return;

    await this.prisma.jobRequisition.update({
      where: { id: requisitionId },
      data: data as Prisma.JobRequisitionUpdateInput,
    });
  }

  private serializeRequisition(
    r: Prisma.JobRequisitionGetPayload<{ include: { _count: { select: { applications: true } } } }> & {
    workLocation?: {
      id: string;
      code: string;
      name: string;
      city: string | null;
      isRemote: boolean;
      isHybrid: boolean;
    } | null;
    workLocationId?: string | null;
    hybrid?: boolean;
  },
  ): Record<string, unknown> {
    const wl = r.workLocation ?? null;
    return {
      id: r.id,
      requisition_number: r.requisitionNumber,
      title: r.title,
      department: r.department,
      legal_entity_id: r.legalEntityId,
      hiring_manager_id: r.hiringManagerId,
      description: r.description,
      requirements: r.requirements,
      responsibilities: r.responsibilities,
      salary_min: r.salaryMin?.toString() ?? null,
      salary_max: r.salaryMax?.toString() ?? null,
      employment_type: r.employmentType,
      location: r.location,
      work_location_id: r.workLocationId ?? null,
      remote: r.remote,
      hybrid: r.hybrid,
      work_location: wl
        ? {
            id: wl.id,
            code: wl.code,
            name: wl.name,
            city: wl.city,
            is_remote: wl.isRemote,
            is_hybrid: wl.isHybrid,
          }
        : null,
      positions: r.positions,
      filled_positions: r.filledPositions,
      priority: r.priority,
      status: r.status,
      published_at: r.publishedAt,
      closing_date: r.closingDate,
      created_by: r.createdBy,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
      application_count: r._count.applications,
    };
  }
}
