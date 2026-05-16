import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateContractorDto } from './dto/create-contractor.dto';
import { UpdateContractorDto } from './dto/update-contractor.dto';
import { QueryContractorDto } from './dto/query-contractor.dto';
import {
  PaginatedContractorResponseDto,
  ContractorResponseDto,
} from './dto/contractor-response.dto';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { AuditService } from '../../core/audit/audit.service';
import { toIgaEventContractorSlice } from '../../core/iga/iga-event.mapper';
import { IgaWorkforceEventWriter } from '../../core/iga/iga-workforce-event-writer.service';

@Injectable()
export class ContractorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly igaWorkforceEventWriter: IgaWorkforceEventWriter,
  ) {}

  async create(
    accessContext: AccessContext,
    createContractorDto: CreateContractorDto,
  ): Promise<ContractorResponseDto> {
    const targetOrgId = accessContext.targetOrganizationId;
    if (!targetOrgId) throw new BadRequestException('Organization context is required');
    // Verify supplier exists and belongs to organization
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: createContractorDto.supplierId,
        organizationId: targetOrgId,
      },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found in your organization');
    }

    // Check for duplicate email within supplier
    const existingContractor = await this.prisma.contractor.findFirst({
      where: {
        supplierId: createContractorDto.supplierId,
        email: createContractorDto.email,
      },
    });

    if (existingContractor) {
      throw new ConflictException(
        'A contractor with this email already exists for this supplier',
      );
    }

    const contractor = await this.prisma.$transaction(async (tx) => {
      const created = await tx.contractor.create({
        data: {
          ...createContractorDto,
          skills: createContractorDto.skills || [],
          dateOfBirth: createContractorDto.dateOfBirth
            ? new Date(createContractorDto.dateOfBirth)
            : undefined,
          accessExpiresAt: createContractorDto.accessExpiresAt
            ? new Date(createContractorDto.accessExpiresAt)
            : undefined,
        },
      });
      await this.igaWorkforceEventWriter.persistExternalPersonCreated(
        toIgaEventContractorSlice(created),
        tx,
      );
      return tx.contractor.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          supplier: {
            select: {
              id: true,
              type: true,
              companyName: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });
    });

    await this.auditService.logAction(
      accessContext.actorUserId,
      'CONTRACTOR_CREATED',
      'Contractor',
      contractor.id,
      null,
      contractor,
      { organizationId: targetOrgId }
    );

    return contractor as any;
  }

  async findAll(
    accessContext: AccessContext,
    query: QueryContractorDto,
  ): Promise<PaginatedContractorResponseDto> {
    const {
      search,
      supplierId,
      workerClassification,
      engagementModel,
      taxResidency,
      isActive,
      skill,
      page = 1,
      limit = 20,
    } = query;

    const where: any = accessContext.isGlobalAccess ? {} : {
      supplier: {
        organizationId: accessContext.targetOrganizationId,
      },
    };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (supplierId) {
      where.supplierId = supplierId;
    }

    if (workerClassification) {
      where.workerClassification = workerClassification;
    }

    if (engagementModel) {
      where.engagementModel = engagementModel;
    }

    if (taxResidency) {
      where.taxResidency = taxResidency;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (skill) {
      where.skills = {
        has: skill,
      };
    }

    const [contractors, total] = await Promise.all([
      this.prisma.contractor.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: {
            select: {
              id: true,
              type: true,
              companyName: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.contractor.count({ where }),
    ]);

    return {
      data: contractors as any,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(
    accessContext: AccessContext,
    id: string,
  ): Promise<ContractorResponseDto> {
    const where: any = { id };
    if (!accessContext.isGlobalAccess) {
      where.supplier = {
        organizationId: accessContext.targetOrganizationId,
      };
    }

    const contractor = await this.prisma.contractor.findFirst({
      where,
      include: {
        supplier: {
          select: {
            id: true,
            type: true,
            companyName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        engagements: {
          select: {
            id: true,
            isActive: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    });

    if (!contractor) {
      throw new NotFoundException('Contractor not found');
    }

    return contractor as any;
  }

  async update(
    accessContext: AccessContext,
    id: string,
    updateContractorDto: UpdateContractorDto,
  ): Promise<ContractorResponseDto> {
    const where: any = { id };
    if (!accessContext.isGlobalAccess) {
      where.supplier = {
        organizationId: accessContext.targetOrganizationId,
      };
    }

    // Check if contractor exists and belongs to organization
    const existingContractor = await this.prisma.contractor.findFirst({
      where,
    });

    if (!existingContractor) {
      throw new NotFoundException('Contractor not found');
    }

    // If changing supplier, verify new supplier belongs to organization
    if (
      updateContractorDto.supplierId &&
      updateContractorDto.supplierId !== existingContractor.supplierId
    ) {
      const newSupplier = await this.prisma.supplier.findFirst({
        where: {
          id: updateContractorDto.supplierId,
          organizationId: accessContext.targetOrganizationId!,
        },
      });

      if (!newSupplier) {
        throw new NotFoundException('New supplier not found in your organization');
      }
    }

    // Check for email conflict if email is being changed
    if (
      updateContractorDto.email &&
      updateContractorDto.email !== existingContractor.email
    ) {
      const emailConflict = await this.prisma.contractor.findFirst({
        where: {
          supplierId: updateContractorDto.supplierId || existingContractor.supplierId,
          email: updateContractorDto.email,
          id: { not: id },
        },
      });

      if (emailConflict) {
        throw new ConflictException(
          'A contractor with this email already exists for this supplier',
        );
      }
    }

    const contractor = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.contractor.update({
        where: { id },
        data: {
          ...updateContractorDto,
          dateOfBirth: updateContractorDto.dateOfBirth
            ? new Date(updateContractorDto.dateOfBirth)
            : undefined,
          accessExpiresAt: updateContractorDto.accessExpiresAt
            ? new Date(updateContractorDto.accessExpiresAt)
            : undefined,
        },
      });
      await this.igaWorkforceEventWriter.persistExternalPersonUpdated(
        toIgaEventContractorSlice(updated),
        tx,
      );
      return tx.contractor.findUniqueOrThrow({
        where: { id: updated.id },
        include: {
          supplier: {
            select: {
              id: true,
              type: true,
              companyName: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });
    });

    await this.auditService.logAction(
      accessContext.actorUserId,
      'CONTRACTOR_UPDATED',
      'Contractor',
      contractor.id,
      existingContractor,
      contractor,
      { organizationId: accessContext.targetOrganizationId },
    );

    return contractor as any;
  }

  async remove(accessContext: AccessContext, id: string): Promise<void> {
    const where: any = { id };
    if (!accessContext.isGlobalAccess) {
      where.supplier = {
        organizationId: accessContext.targetOrganizationId,
      };
    }

    const contractor = await this.prisma.contractor.findFirst({
      where,
      include: {
        engagements: true,
      },
    });

    if (!contractor) {
      throw new NotFoundException('Contractor not found');
    }

    // Check if contractor has active engagements
    const activeEngagements = contractor.engagements.filter(
      (e) => e.isActive,
    );

    if (activeEngagements.length > 0) {
      throw new BadRequestException(
        'Cannot delete contractor with active engagements. Please end engagements first.',
      );
    }

    await this.prisma.contractor.delete({
      where: { id },
    });

    await this.auditService.logAction(
      accessContext.actorUserId,
      'CONTRACTOR_DELETED',
      'Contractor',
      id,
      contractor,
      null,
      { organizationId: accessContext.targetOrganizationId }
    );
  }

  async deactivate(accessContext: AccessContext, id: string): Promise<ContractorResponseDto> {
    const where: any = { id };
    if (!accessContext.isGlobalAccess) {
      where.supplier = {
        organizationId: accessContext.targetOrganizationId,
      };
    }

    const contractor = await this.prisma.contractor.findFirst({
      where,
    });

    if (!contractor) {
      throw new NotFoundException('Contractor not found');
    }

    return this.prisma.contractor.update({
      where: { id },
      data: { isActive: false },
      include: {
        supplier: {
          select: {
            id: true,
            type: true,
            companyName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    }) as any;
  }
}
