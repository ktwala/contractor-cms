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

@Injectable()
export class ContractorsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    createContractorDto: CreateContractorDto,
  ): Promise<ContractorResponseDto> {
    // Verify supplier exists and belongs to organization
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: createContractorDto.supplierId,
        organizationId,
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

    const contractor = await this.prisma.contractor.create({
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

    return contractor as any;
  }

  async findAll(
    organizationId: string,
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

    const where: any = {
      supplier: {
        organizationId,
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
    organizationId: string,
    id: string,
  ): Promise<ContractorResponseDto> {
    const contractor = await this.prisma.contractor.findFirst({
      where: {
        id,
        supplier: {
          organizationId,
        },
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
            status: true,
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
    organizationId: string,
    id: string,
    updateContractorDto: UpdateContractorDto,
  ): Promise<ContractorResponseDto> {
    // Check if contractor exists and belongs to organization
    const existingContractor = await this.prisma.contractor.findFirst({
      where: {
        id,
        supplier: {
          organizationId,
        },
      },
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
          organizationId,
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

    const contractor = await this.prisma.contractor.update({
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

    return contractor as any;
  }

  async remove(organizationId: string, id: string): Promise<void> {
    const contractor = await this.prisma.contractor.findFirst({
      where: {
        id,
        supplier: {
          organizationId,
        },
      },
      include: {
        engagements: true,
      },
    });

    if (!contractor) {
      throw new NotFoundException('Contractor not found');
    }

    // Check if contractor has active engagements
    const activeEngagements = contractor.engagements.filter(
      (e) => e.status === 'ACTIVE',
    );

    if (activeEngagements.length > 0) {
      throw new BadRequestException(
        'Cannot delete contractor with active engagements. Please end engagements first.',
      );
    }

    await this.prisma.contractor.delete({
      where: { id },
    });
  }

  async deactivate(organizationId: string, id: string): Promise<ContractorResponseDto> {
    const contractor = await this.prisma.contractor.findFirst({
      where: {
        id,
        supplier: {
          organizationId,
        },
      },
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
