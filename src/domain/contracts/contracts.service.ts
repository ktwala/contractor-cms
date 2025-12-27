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

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    createContractDto: CreateContractDto,
    userId: string,
  ): Promise<ContractResponseDto> {
    // Verify supplier exists and belongs to organization
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: createContractDto.supplierId,
        organizationId,
      },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found in your organization');
    }

    // Check for duplicate contract number within organization
    const existingContract = await this.prisma.supplierContract.findFirst({
      where: {
        organizationId,
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
        organizationId,
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
    organizationId: string,
    query: QueryContractDto,
  ): Promise<PaginatedContractResponseDto> {
    const {
      search,
      supplierId,
      contractType,
      status,
      currency,
      page = 1,
      limit = 20,
    } = query;

    const where: any = {
      organizationId,
    };

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
    organizationId: string,
    id: string,
  ): Promise<ContractResponseDto> {
    const contract = await this.prisma.supplierContract.findFirst({
      where: {
        id,
        organizationId,
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
            status: true,
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
    organizationId: string,
    id: string,
    updateContractDto: UpdateContractDto,
  ): Promise<ContractResponseDto> {
    // Check if contract exists and belongs to organization
    const existingContract = await this.prisma.supplierContract.findFirst({
      where: {
        id,
        organizationId,
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
          organizationId,
        },
      });

      if (!newSupplier) {
        throw new NotFoundException('New supplier not found in your organization');
      }
    }

    // Check for contract number conflict if number is being changed
    if (
      updateContractDto.contractNumber &&
      updateContractDto.contractNumber !== existingContract.contractNumber
    ) {
      const numberConflict = await this.prisma.supplierContract.findFirst({
        where: {
          organizationId,
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

  async remove(organizationId: string, id: string): Promise<void> {
    const contract = await this.prisma.supplierContract.findFirst({
      where: {
        id,
        organizationId,
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
    organizationId: string,
    id: string,
    signedBy: string,
  ): Promise<ContractResponseDto> {
    const contract = await this.prisma.supplierContract.findFirst({
      where: {
        id,
        organizationId,
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
    organizationId: string,
    id: string,
  ): Promise<ContractResponseDto> {
    const contract = await this.prisma.supplierContract.findFirst({
      where: {
        id,
        organizationId,
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
