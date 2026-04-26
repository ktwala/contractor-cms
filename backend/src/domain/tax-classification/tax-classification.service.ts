import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateTaxClassificationDto } from './dto/create-tax-classification.dto';
import { UpdateTaxClassificationDto } from './dto/update-tax-classification.dto';
import { QueryTaxClassificationDto } from './dto/query-tax-classification.dto';
import {
  PaginatedTaxClassificationResponseDto,
  TaxClassificationResponseDto,
} from './dto/tax-classification-response.dto';

@Injectable()
export class TaxClassificationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    userId: string,
    dto: CreateTaxClassificationDto,
  ): Promise<TaxClassificationResponseDto> {
    // Verify contractor exists and belongs to organization
    const contractor = await this.prisma.contractor.findFirst({
      where: {
        id: dto.contractorId,
        supplier: {
          organizationId,
        },
      },
    });

    if (!contractor) {
      throw new NotFoundException(
        'Contractor not found in your organization',
      );
    }

    // Verify engagement exists and belongs to organization (if provided)
    if (dto.engagementId) {
      const engagement = await this.prisma.contractorEngagement.findFirst({
        where: {
          id: dto.engagementId,
          contractorId: dto.contractorId,
          contractor: {
            supplier: {
              organizationId,
            },
          },
        },
      });

      if (!engagement) {
        throw new NotFoundException(
          'Engagement not found for this contractor',
        );
      }
    }

    // Validate dates
    const validFrom = new Date(dto.validFrom);
    const validTo = dto.validTo ? new Date(dto.validTo) : undefined;

    if (validTo && validTo <= validFrom) {
      throw new BadRequestException(
        'Valid to date must be after valid from date',
      );
    }

    // Check for overlapping classifications
    const overlapping = await this.prisma.contractorTaxClassification.findFirst(
      {
        where: {
          contractorId: dto.contractorId,
          engagementId: dto.engagementId || null,
          OR: [
            {
              validFrom: { lte: validFrom },
              validTo: validTo ? { gte: validFrom } : null,
            },
            {
              validFrom: validTo ? { lte: validTo } : undefined,
              validTo: validTo ? { gte: validTo } : null,
            },
          ],
        },
      },
    );

    if (overlapping) {
      throw new BadRequestException(
        'An overlapping tax classification already exists for this contractor',
      );
    }

    const classification = await this.prisma.contractorTaxClassification.create(
      {
        data: {
          contractorId: dto.contractorId,
          engagementId: dto.engagementId,
          classification: dto.classification,
          basis: dto.basis,
          assessmentPayload: dto.assessmentPayload,
          dominantImpression: dto.dominantImpression,
          riskScore: dto.riskScore,
          assessedBy: userId,
          validFrom,
          validTo,
          notes: dto.notes,
        },
        include: {
          contractor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
    );

    return classification as any;
  }

  async findAll(
    organizationId: string,
    query: QueryTaxClassificationDto,
  ): Promise<PaginatedTaxClassificationResponseDto> {
    const {
      contractorId,
      engagementId,
      classification,
      basis,
      validFrom,
      validTo,
      page = 1,
      limit = 20,
    } = query;

    const where: any = {
      contractor: {
        supplier: {
          organizationId,
        },
      },
    };

    if (contractorId) {
      where.contractorId = contractorId;
    }

    if (engagementId) {
      where.engagementId = engagementId;
    }

    if (classification) {
      where.classification = classification;
    }

    if (basis) {
      where.basis = basis;
    }

    if (validFrom) {
      where.validFrom = { gte: new Date(validFrom) };
    }

    if (validTo) {
      where.validTo = { lte: new Date(validTo) };
    }

    const [classifications, total] = await Promise.all([
      this.prisma.contractorTaxClassification.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { assessedAt: 'desc' },
        include: {
          contractor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.contractorTaxClassification.count({ where }),
    ]);

    return {
      data: classifications as any,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(
    organizationId: string,
    id: string,
  ): Promise<TaxClassificationResponseDto> {
    const classification = await this.prisma.contractorTaxClassification.findFirst(
      {
        where: {
          id,
          contractor: {
            supplier: {
              organizationId,
            },
          },
        },
        include: {
          contractor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              supplier: {
                select: {
                  id: true,
                  companyName: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      },
    );

    if (!classification) {
      throw new NotFoundException('Tax classification not found');
    }

    return classification as any;
  }

  async findActiveClassification(
    organizationId: string,
    contractorId: string,
    engagementId?: string,
  ): Promise<TaxClassificationResponseDto | null> {
    const now = new Date();

    const classification = await this.prisma.contractorTaxClassification.findFirst(
      {
        where: {
          contractorId,
          engagementId: engagementId || null,
          contractor: {
            supplier: {
              organizationId,
            },
          },
          validFrom: { lte: now },
          OR: [{ validTo: null }, { validTo: { gte: now } }],
        },
        orderBy: { assessedAt: 'desc' },
        include: {
          contractor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
    );

    return classification as any;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateTaxClassificationDto,
  ): Promise<TaxClassificationResponseDto> {
    // Check if classification exists and belongs to organization
    const existingClassification =
      await this.prisma.contractorTaxClassification.findFirst({
        where: {
          id,
          contractor: {
            supplier: {
              organizationId,
            },
          },
        },
      });

    if (!existingClassification) {
      throw new NotFoundException('Tax classification not found');
    }

    // Validate dates if being updated
    const validFrom = dto.validFrom
      ? new Date(dto.validFrom)
      : existingClassification.validFrom;
    const validTo = dto.validTo
      ? new Date(dto.validTo)
      : existingClassification.validTo;

    if (validTo && validTo <= validFrom) {
      throw new BadRequestException(
        'Valid to date must be after valid from date',
      );
    }

    const classification = await this.prisma.contractorTaxClassification.update(
      {
        where: { id },
        data: {
          classification: dto.classification,
          basis: dto.basis,
          assessmentPayload: dto.assessmentPayload,
          dominantImpression: dto.dominantImpression,
          riskScore: dto.riskScore,
          validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
          validTo: dto.validTo ? new Date(dto.validTo) : undefined,
          notes: dto.notes,
          approvedBy: dto.approvedBy,
          approvedAt: dto.approvedAt ? new Date(dto.approvedAt) : undefined,
        },
        include: {
          contractor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
    );

    return classification as any;
  }

  async remove(organizationId: string, id: string): Promise<void> {
    const classification = await this.prisma.contractorTaxClassification.findFirst(
      {
        where: {
          id,
          contractor: {
            supplier: {
              organizationId,
            },
          },
        },
      },
    );

    if (!classification) {
      throw new NotFoundException('Tax classification not found');
    }

    await this.prisma.contractorTaxClassification.delete({
      where: { id },
    });
  }

  async approve(
    organizationId: string,
    id: string,
    approvedBy: string,
  ): Promise<TaxClassificationResponseDto> {
    const classification = await this.prisma.contractorTaxClassification.findFirst(
      {
        where: {
          id,
          contractor: {
            supplier: {
              organizationId,
            },
          },
        },
      },
    );

    if (!classification) {
      throw new NotFoundException('Tax classification not found');
    }

    if (classification.approvedBy) {
      throw new BadRequestException(
        'Tax classification has already been approved',
      );
    }

    return this.prisma.contractorTaxClassification.update({
      where: { id },
      data: {
        approvedBy,
        approvedAt: new Date(),
      },
      include: {
        contractor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    }) as any;
  }
}
