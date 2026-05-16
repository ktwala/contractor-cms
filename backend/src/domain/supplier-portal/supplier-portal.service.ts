import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { AuditService } from '../../core/audit/audit.service';
import { toIgaEventContractorSlice } from '../../core/iga/iga-event.mapper';
import { IgaWorkforceEventWriter } from '../../core/iga/iga-workforce-event-writer.service';
import { SupplierPortalUpdateProfileDto } from './dto/supplier-portal-update-profile.dto';
import { SupplierPortalCreateContractorDto } from './dto/supplier-portal-create-contractor.dto';
import { QueryTimesheetDto } from '../timesheets/dto/query-timesheet.dto';

const contractorListSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  workerClassification: true,
  engagementModel: true,
  isActive: true,
  createdAt: true,
} as const;

@Injectable()
export class SupplierPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly igaWorkforceEventWriter: IgaWorkforceEventWriter,
  ) {}

  private requireSupplierScope(accessContext: AccessContext): string {
    if (!accessContext.supplierScopeId) {
      throw new ForbiddenException(
        'Active supplier membership required for supplier portal access',
      );
    }
    return accessContext.supplierScopeId;
  }

  async getProfile(accessContext: AccessContext) {
    const supplierId = this.requireSupplierScope(accessContext);
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: supplierId,
        organizationId: accessContext.targetOrganizationId ?? undefined,
      },
      include: { documents: true },
    });
    if (!supplier) {
      throw new NotFoundException('Supplier profile not found');
    }
    return supplier;
  }

  async updateProfile(
    accessContext: AccessContext,
    dto: SupplierPortalUpdateProfileDto,
  ) {
    const supplierId = this.requireSupplierScope(accessContext);
    const existing = await this.prisma.supplier.findFirst({
      where: {
        id: supplierId,
        organizationId: accessContext.targetOrganizationId ?? undefined,
      },
    });
    if (!existing) {
      throw new NotFoundException('Supplier profile not found');
    }

    return this.prisma.supplier.update({
      where: { id: supplierId },
      data: dto,
    });
  }

  async listContractors(
    accessContext: AccessContext,
    page = 1,
    limit = 20,
  ) {
    const supplierId = this.requireSupplierScope(accessContext);
    const where = { supplierId, isActive: true };

    const [data, total] = await Promise.all([
      this.prisma.contractor.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: contractorListSelect,
      }),
      this.prisma.contractor.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async createContractor(
    accessContext: AccessContext,
    dto: SupplierPortalCreateContractorDto,
  ) {
    const supplierId = this.requireSupplierScope(accessContext);
    const targetOrgId = accessContext.targetOrganizationId;
    if (!targetOrgId) {
      throw new BadRequestException('Organization context is required');
    }

    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, organizationId: targetOrgId },
    });
    if (!supplier) {
      throw new NotFoundException('Supplier profile not found');
    }

    const existing = await this.prisma.contractor.findFirst({
      where: { supplierId, email: dto.email },
    });
    if (existing) {
      throw new ConflictException(
        'A contractor with this email already exists for your supplier',
      );
    }

    const contractor = await this.prisma.$transaction(async (tx) => {
      const created = await tx.contractor.create({
        data: {
          supplierId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone,
          workerClassification: dto.workerClassification,
          engagementModel: dto.engagementModel,
          taxResidency: dto.taxResidency,
          skills: [],
        },
      });
      await this.igaWorkforceEventWriter.persistExternalPersonCreated(
        toIgaEventContractorSlice(created),
        targetOrgId,
        tx,
      );
      return tx.contractor.findUniqueOrThrow({
        where: { id: created.id },
        select: contractorListSelect,
      });
    });

    await this.auditService.logAction(
      accessContext.actorUserId,
      'CONTRACTOR_CREATED',
      'Contractor',
      contractor.id,
      null,
      contractor,
      { organizationId: targetOrgId },
    );

    return contractor;
  }

  async listTimesheets(accessContext: AccessContext, query: QueryTimesheetDto) {
    const supplierId = this.requireSupplierScope(accessContext);
    const {
      contractorId,
      status,
      page = 1,
      limit = 20,
    } = query;

    const where: Record<string, unknown> = {
      contractor: { supplierId },
    };

    if (contractorId) {
      where.contractorId = contractorId;
    }
    if (status) {
      where.status = status;
    }

    const [data, total] = await Promise.all([
      this.prisma.timesheet.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          contractor: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
      this.prisma.timesheet.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
