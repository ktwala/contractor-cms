import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { UpdateSupplierDto } from '../suppliers/dto/update-supplier.dto';
import { CreateContractorDto } from '../contractors/dto/create-contractor.dto';
import { QueryTimesheetDto } from '../timesheets/dto/query-timesheet.dto';

@Injectable()
export class SupplierPortalService {
  constructor(private readonly prisma: PrismaService) {}

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
    dto: UpdateSupplierDto,
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
      data: {
        ...dto,
        taxClearanceExpiry: dto.taxClearanceExpiry
          ? new Date(dto.taxClearanceExpiry)
          : undefined,
        bbbeeExpiry: dto.bbbeeExpiry ? new Date(dto.bbbeeExpiry) : undefined,
      },
    });
  }

  async listResources(
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
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          workerClassification: true,
          engagementModel: true,
          isActive: true,
          createdAt: true,
        },
      }),
      this.prisma.contractor.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async createResource(
    accessContext: AccessContext,
    dto: CreateContractorDto,
  ) {
    const supplierId = this.requireSupplierScope(accessContext);
    const targetOrgId = accessContext.targetOrganizationId;
    if (!targetOrgId) {
      throw new BadRequestException('Organization context is required');
    }

    if (dto.supplierId && dto.supplierId !== supplierId) {
      throw new ForbiddenException('Cannot nominate resources for another supplier');
    }

    const existing = await this.prisma.contractor.findFirst({
      where: { supplierId, email: dto.email },
    });
    if (existing) {
      throw new BadRequestException(
        'A resource with this email already exists for your supplier',
      );
    }

    return this.prisma.contractor.create({
      data: {
        ...dto,
        supplierId,
        skills: dto.skills || [],
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        accessExpiresAt: dto.accessExpiresAt
          ? new Date(dto.accessExpiresAt)
          : undefined,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        workerClassification: true,
        engagementModel: true,
        isActive: true,
        createdAt: true,
      },
    });
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
