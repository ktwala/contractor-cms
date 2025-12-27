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

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    createSupplierDto: CreateSupplierDto,
  ): Promise<SupplierResponseDto> {
    // Validate type-specific required fields
    this.validateSupplierData(createSupplierDto);

    // Check for duplicate email within organization
    const existingSupplier = await this.prisma.supplier.findFirst({
      where: {
        organizationId,
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
        organizationId,
        status: SupplierStatus.PENDING_APPROVAL,
        taxClearanceExpiry: createSupplierDto.taxClearanceExpiry
          ? new Date(createSupplierDto.taxClearanceExpiry)
          : undefined,
        bbbeeExpiry: createSupplierDto.bbbeeExpiry
          ? new Date(createSupplierDto.bbbeeExpiry)
          : undefined,
      },
    });

    return supplier;
  }

  async findAll(
    organizationId: string,
    query: QuerySupplierDto,
  ): Promise<PaginatedSupplierResponseDto> {
    const { search, type, status, country, page = 1, limit = 20 } = query;

    const where: any = {
      organizationId,
    };

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
      data: suppliers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(
    organizationId: string,
    id: string,
  ): Promise<SupplierResponseDto> {
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id,
        organizationId,
      },
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
    organizationId: string,
    id: string,
    updateSupplierDto: UpdateSupplierDto,
  ): Promise<SupplierResponseDto> {
    // Check if supplier exists and belongs to organization
    const existingSupplier = await this.prisma.supplier.findFirst({
      where: {
        id,
        organizationId,
      },
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
          organizationId,
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

    return supplier;
  }

  async remove(organizationId: string, id: string): Promise<void> {
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id,
        organizationId,
      },
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
  }

  async updateStatus(
    organizationId: string,
    id: string,
    status: SupplierStatus,
  ): Promise<SupplierResponseDto> {
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id,
        organizationId,
      },
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
