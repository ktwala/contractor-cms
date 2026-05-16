import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { QuerySupplierDto } from './dto/query-supplier.dto';
import { SupplierType, SupplierStatus } from '@prisma/client';
import {
  PaginatedSupplierResponseDto,
  SupplierResponseDto,
} from './dto/supplier-response.dto';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { AuditService } from '../../core/audit/audit.service';

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    accessContext: AccessContext,
    createSupplierDto: CreateSupplierDto,
  ): Promise<SupplierResponseDto> {
    // Validate type-specific required fields
    this.validateSupplierData(createSupplierDto);

    const targetOrgId = accessContext.targetOrganizationId;

    if (!targetOrgId) {
      throw new BadRequestException('Organization context is required to create a supplier');
    }

    // Check for duplicate email within organization
    const existingSupplier = await this.prisma.supplier.findFirst({
      where: {
        organizationId: targetOrgId,
        email: createSupplierDto.email,
      },
    });

    if (existingSupplier) {
      throw new ConflictException(
        'A supplier with this email already exists in your organization',
      );
    }

    const supplier = await this.prisma.supplier.create({
      data: {
        ...createSupplierDto,
        organizationId: targetOrgId,
        status: SupplierStatus.PENDING_APPROVAL,
        taxClearanceExpiry: createSupplierDto.taxClearanceExpiry
          ? new Date(createSupplierDto.taxClearanceExpiry)
          : undefined,
        bbbeeExpiry: createSupplierDto.bbbeeExpiry
          ? new Date(createSupplierDto.bbbeeExpiry)
          : undefined,
      },
    });

    await this.auditService.logAction(
      accessContext.actorUserId,
      'SUPPLIER_CREATED',
      'Supplier',
      supplier.id,
      null,
      supplier,
      {
        organizationId: supplier.organizationId,
      }
    );

    return supplier as any;
  }

  async findAll(
    accessContext: AccessContext,
    query: QuerySupplierDto,
  ): Promise<PaginatedSupplierResponseDto> {
    const { search, type, status, country, page = 1, limit = 20 } = query;

    const where: any = accessContext.isGlobalAccess 
      ? {} 
      : { organizationId: accessContext.targetOrganizationId };

    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { tradingName: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    if (country) {
      where.country = country;
    }

    const [suppliers, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return {
      data: suppliers as any,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(
    accessContext: AccessContext,
    id: string,
  ): Promise<any> {
    const where: any = { id };
    if (!accessContext.isGlobalAccess) {
      where.organizationId = accessContext.targetOrganizationId;
    }

    const supplier = await this.prisma.supplier.findFirst({
      where,
      include: {
        documents: true,
        contractors: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    return supplier as any;
  }

  async update(
    accessContext: AccessContext,
    id: string,
    updateSupplierDto: UpdateSupplierDto,
  ): Promise<any> {
    const where: any = { id };
    if (!accessContext.isGlobalAccess) {
      where.organizationId = accessContext.targetOrganizationId;
    }

    // Check if supplier exists and belongs to organization
    const existingSupplier = await this.prisma.supplier.findFirst({
      where,
    });

    if (!existingSupplier) {
      throw new NotFoundException('Supplier not found');
    }

    // If changing type, validate new type-specific fields
    if (updateSupplierDto.type && updateSupplierDto.type !== existingSupplier.type) {
      this.validateSupplierData({
        ...existingSupplier,
        ...updateSupplierDto,
      } as CreateSupplierDto);
    }

    // Check for email conflict if email is being changed
    if (updateSupplierDto.email && updateSupplierDto.email !== existingSupplier.email) {
      const emailConflict = await this.prisma.supplier.findFirst({
        where: {
          organizationId: existingSupplier.organizationId,
          email: updateSupplierDto.email,
          id: { not: id },
        },
      });

      if (emailConflict) {
        throw new ConflictException(
          'A supplier with this email already exists in your organization',
        );
      }
    }

    const supplier = await this.prisma.supplier.update({
      where: { id },
      data: {
        ...updateSupplierDto,
        taxClearanceExpiry: updateSupplierDto.taxClearanceExpiry
          ? new Date(updateSupplierDto.taxClearanceExpiry)
          : undefined,
        bbbeeExpiry: updateSupplierDto.bbbeeExpiry
          ? new Date(updateSupplierDto.bbbeeExpiry)
          : undefined,
      },
    });

    await this.auditService.logAction(
      accessContext.actorUserId,
      'SUPPLIER_UPDATED',
      'Supplier',
      supplier.id,
      existingSupplier,
      supplier,
      { organizationId: supplier.organizationId }
    );

    return supplier;
  }

  async remove(accessContext: AccessContext, id: string): Promise<void> {
    const where: any = { id };
    if (!accessContext.isGlobalAccess) {
      where.organizationId = accessContext.targetOrganizationId;
    }

    const supplier = await this.prisma.supplier.findFirst({
      where,
      include: {
        contractors: true,
        contracts: true,
      },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    // Check if supplier has active contractors
    if (supplier.contractors.length > 0) {
      throw new BadRequestException(
        'Cannot delete supplier with associated contractors. Please remove contractors first.',
      );
    }

    // Check if supplier has active contracts
    const activeContracts = supplier.contracts.filter(
      (c) => c.status !== 'TERMINATED' && c.status !== 'EXPIRED',
    );

    if (activeContracts.length > 0) {
      throw new BadRequestException(
        'Cannot delete supplier with active contracts. Please terminate contracts first.',
      );
    }

    await this.prisma.supplier.delete({
      where: { id },
    });

    await this.auditService.logAction(
      accessContext.actorUserId,
      'SUPPLIER_DELETED',
      'Supplier',
      id,
      supplier,
      null,
      { organizationId: supplier.organizationId }
    );
  }

  async updateStatus(
    accessContext: AccessContext,
    id: string,
    status: SupplierStatus,
  ): Promise<any> {
    const where: any = { id };
    if (!accessContext.isGlobalAccess) {
      where.organizationId = accessContext.targetOrganizationId;
    }

    const supplier = await this.prisma.supplier.findFirst({
      where,
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    return this.prisma.supplier.update({
      where: { id },
      data: { status },
    });
  }

  private validateSupplierData(data: CreateSupplierDto): void {
    if (data.type === SupplierType.COMPANY) {
      if (!data.companyName) {
        throw new BadRequestException(
          'Company name is required for COMPANY type suppliers',
        );
      }
    } else if (data.type === SupplierType.INDIVIDUAL) {
      if (!data.firstName || !data.lastName) {
        throw new BadRequestException(
          'First name and last name are required for INDIVIDUAL type suppliers',
        );
      }
    }
  }
}
