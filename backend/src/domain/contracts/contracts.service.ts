import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { QueryContractDto } from './dto/query-contract.dto';
import {
  PaginatedContractResponseDto,
  ContractResponseDto,
} from './dto/contract-response.dto';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { assertSupplierOperationalTrustGranted } from '../suppliers/supplier-operational-trust.util';

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    accessContext: AccessContext,
    createContractDto: CreateContractDto,
    userId: string,
  ): Promise<ContractResponseDto> {
    const targetOrgId = accessContext.targetOrganizationId;
    if (!targetOrgId) throw new BadRequestException('Organization context is required');
    // Verify supplier exists and belongs to organization
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: createContractDto.supplierId,
        organizationId: targetOrgId,
      },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found in your organization');
    }

    assertSupplierOperationalTrustGranted({
      status: supplier.status,
      supplierName: supplier.tradingName ?? supplier.companyName ?? undefined,
    });

    // Check for duplicate contract number within organization
    const existingContract = await this.prisma.supplierContract.findFirst({
      where: {
        organizationId: targetOrgId,
        contractNumber: createContractDto.contractNumber,
      },
    });

    if (existingContract) {
      throw new ConflictException(
        'A contract with this number already exists in your organization',
      );
    }

    // Validate dates
    const startDate = new Date(createContractDto.startDate);
    const endDate = createContractDto.endDate
      ? new Date(createContractDto.endDate)
      : undefined;

    if (endDate && endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    const contract = await this.prisma.supplierContract.create({
      data: {
        organizationId: targetOrgId,
        supplierId: createContractDto.supplierId,
        contractNumber: createContractDto.contractNumber,
        contractType: createContractDto.contractType,
        title: createContractDto.title,
        description: createContractDto.description,
        startDate,
        endDate,
        currency: createContractDto.currency || 'ZAR',
        totalValue: createContractDto.totalValue,
        rateCard: createContractDto.rateCard || {},
        paymentTermsDays: createContractDto.paymentTermsDays ?? 30,
        noticePeriodDays: createContractDto.noticePeriodDays,
        slaTerms: createContractDto.slaTerms || {},
        status: 'DRAFT',
      },
      include: {
        supplier: {
          select: {
            id: true,
            companyName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return contract as any;
  }

  async findAll(
    accessContext: AccessContext,
    query: QueryContractDto,
  ): Promise<PaginatedContractResponseDto> {
    const {
      search,
      supplierId,
      contractType,
      status,
      currency,
      expiresBefore,
      expiresAfter,
      expiresWithinDays,
      expiryState,
      page = 1,
      limit = 20,
    } = query;

    const where: any = accessContext.isGlobalAccess 
      ? {} 
      : { organizationId: accessContext.targetOrganizationId };

    if (search) {
      where.OR = [
        { contractNumber: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (supplierId) {
      where.supplierId = supplierId;
    }

    if (contractType) {
      where.contractType = contractType;
    }

    if (status) {
      where.status = status;
    }

    if (currency) {
      where.currency = currency;
    }

    if (expiresBefore || expiresAfter || expiresWithinDays !== undefined || expiryState) {
      where.endDate = {};
    }

    if (expiresBefore) {
      where.endDate = { ...where.endDate, lte: new Date(expiresBefore) };
    }
    if (expiresAfter) {
      where.endDate = { ...where.endDate, gte: new Date(expiresAfter) };
    }
    if (expiresWithinDays !== undefined) {
      const now = new Date();
      const future = new Date();
      future.setDate(future.getDate() + expiresWithinDays);
      where.endDate = { ...where.endDate, gte: now, lte: future };
    }
    if (expiryState) {
      const now = new Date();
      const soonThreshold = new Date();
      soonThreshold.setDate(soonThreshold.getDate() + 60);

      switch (expiryState) {
        case 'expired':
          where.endDate = { ...where.endDate, lt: now };
          break;
        case 'expiring_soon':
          where.endDate = { ...where.endDate, gte: now, lte: soonThreshold };
          break;
        case 'active':
          where.endDate = { ...where.endDate, gt: soonThreshold };
          break;
        case 'missing_end_date':
          where.endDate = null;
          break;
      }
    }

    const [contracts, total] = await Promise.all([
      this.prisma.supplierContract.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: {
            select: {
              id: true,
              companyName: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.supplierContract.count({ where }),
    ]);

    return {
      data: contracts as any,
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
    const targetOrgId = accessContext.isGlobalAccess ? undefined : accessContext.targetOrganizationId;
    const contract = await this.prisma.supplierContract.findFirst({
      where: {
        id,
        organizationId: targetOrgId || undefined,
      },
      include: {
        supplier: {
          select: {
            id: true,
            companyName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        engagements: {
          select: {
            id: true,
            contractor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            isActive: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    return contract as any;
  }

  async update(
    accessContext: AccessContext,
    id: string,
    updateContractDto: UpdateContractDto,
  ): Promise<any> {
    const targetOrgId = accessContext.isGlobalAccess ? undefined : accessContext.targetOrganizationId;
    // Check if contract exists and belongs to organization
    const existingContract = await this.prisma.supplierContract.findFirst({
      where: {
        id,
        organizationId: targetOrgId || undefined,
      },
    });

    if (!existingContract) {
      throw new NotFoundException('Contract not found');
    }

    // If changing supplier, verify new supplier belongs to organization
    if (
      updateContractDto.supplierId &&
      updateContractDto.supplierId !== existingContract.supplierId
    ) {
      const newSupplier = await this.prisma.supplier.findFirst({
        where: {
          id: updateContractDto.supplierId,
          organizationId: targetOrgId || undefined,
        },
      });

      if (!newSupplier) {
        throw new NotFoundException('New supplier not found in your organization');
      }

      assertSupplierOperationalTrustGranted({
        status: newSupplier.status,
        supplierName: newSupplier.tradingName ?? newSupplier.companyName ?? undefined,
      });
    }

    // Check for contract number conflict if number is being changed
    if (
      updateContractDto.contractNumber &&
      updateContractDto.contractNumber !== existingContract.contractNumber
    ) {
      const numberConflict = await this.prisma.supplierContract.findFirst({
        where: {
          organizationId: targetOrgId || undefined,
          contractNumber: updateContractDto.contractNumber,
          id: { not: id },
        },
      });

      if (numberConflict) {
        throw new ConflictException(
          'A contract with this number already exists in your organization',
        );
      }
    }

    // Validate dates if being updated
    const startDate = updateContractDto.startDate
      ? new Date(updateContractDto.startDate)
      : existingContract.startDate;
    const endDate = updateContractDto.endDate
      ? new Date(updateContractDto.endDate)
      : existingContract.endDate;

    if (endDate && endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    const contract = await this.prisma.supplierContract.update({
      where: { id },
      data: {
        ...updateContractDto,
        startDate: updateContractDto.startDate
          ? new Date(updateContractDto.startDate)
          : undefined,
        endDate: updateContractDto.endDate
          ? new Date(updateContractDto.endDate)
          : undefined,
        signedAt: updateContractDto.signedAt
          ? new Date(updateContractDto.signedAt)
          : undefined,
      },
      include: {
        supplier: {
          select: {
            id: true,
            companyName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return contract as any;
  }

  async remove(accessContext: AccessContext, id: string): Promise<void> {
    const targetOrgId = accessContext.isGlobalAccess ? undefined : accessContext.targetOrganizationId;
    const contract = await this.prisma.supplierContract.findFirst({
      where: {
        id,
        organizationId: targetOrgId || undefined,
      },
      include: {
        engagements: true,
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    // Only allow deletion if status is DRAFT
    if (contract.status !== 'DRAFT') {
      throw new BadRequestException(
        'Only draft contracts can be deleted. Please terminate the contract instead.',
      );
    }

    // Check if contract has engagements
    if (contract.engagements.length > 0) {
      throw new BadRequestException(
        'Cannot delete contract with existing engagements.',
      );
    }

    await this.prisma.supplierContract.delete({
      where: { id },
    });
  }

  async signContract(
    accessContext: AccessContext,
    id: string,
    signedBy: string,
  ): Promise<any> {
    const targetOrgId = accessContext.isGlobalAccess ? undefined : accessContext.targetOrganizationId;
    const contract = await this.prisma.supplierContract.findFirst({
      where: {
        id,
        organizationId: targetOrgId || undefined,
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.status !== 'DRAFT') {
      throw new BadRequestException('Only draft contracts can be signed');
    }

    return this.prisma.supplierContract.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        signedAt: new Date(),
        signedBy,
      },
      include: {
        supplier: {
          select: {
            id: true,
            companyName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    }) as any;
  }

  async terminateContract(
    accessContext: AccessContext,
    id: string,
  ): Promise<any> {
    const targetOrgId = accessContext.isGlobalAccess ? undefined : accessContext.targetOrganizationId;
    const contract = await this.prisma.supplierContract.findFirst({
      where: {
        id,
        organizationId: targetOrgId || undefined,
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.status === 'TERMINATED' || contract.status === 'EXPIRED') {
      throw new BadRequestException('Contract is already terminated or expired');
    }

    return this.prisma.supplierContract.update({
      where: { id },
      data: {
        status: 'TERMINATED',
      },
      include: {
        supplier: {
          select: {
            id: true,
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
