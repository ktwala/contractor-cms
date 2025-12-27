import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateWithholdingDto } from './dto/create-withholding.dto';
import { UpdateWithholdingDto } from './dto/update-withholding.dto';
import { QueryWithholdingDto } from './dto/query-withholding.dto';
import {
  PaginatedWithholdingResponseDto,
  WithholdingResponseDto,
} from './dto/withholding-response.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class WithholdingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate SARS withholding amounts
   * Based on South African tax tables for 2024/2025
   */
  calculateWithholdingAmounts(
    withholdingType: string,
    grossAmount: number,
  ): {
    withholdingAmount: number;
    netAmount: number;
  } {
    let withholdingAmount = 0;

    switch (withholdingType) {
      case 'PAYE':
        // Simplified PAYE calculation
        // In production, this should use actual SARS tax tables
        // This is a simplified progressive rate:
        // 0-237,100: 18%
        // 237,101-370,500: 26%
        // 370,501-512,800: 31%
        // 512,801-673,000: 36%
        // 673,001-857,900: 39%
        // 857,901-1,817,000: 41%
        // Over 1,817,000: 45%

        const annualGross = grossAmount * 12; // Assume monthly payment

        if (annualGross <= 237100) {
          withholdingAmount = grossAmount * 0.18;
        } else if (annualGross <= 370500) {
          withholdingAmount = grossAmount * 0.26;
        } else if (annualGross <= 512800) {
          withholdingAmount = grossAmount * 0.31;
        } else if (annualGross <= 673000) {
          withholdingAmount = grossAmount * 0.36;
        } else if (annualGross <= 857900) {
          withholdingAmount = grossAmount * 0.39;
        } else if (annualGross <= 1817000) {
          withholdingAmount = grossAmount * 0.41;
        } else {
          withholdingAmount = grossAmount * 0.45;
        }
        break;

      case 'SDL':
        // Skills Development Levy: 1% of gross
        withholdingAmount = grossAmount * 0.01;
        break;

      case 'UIF':
        // Unemployment Insurance Fund: 1% of gross (capped)
        // Max contribution is based on earnings threshold
        const maxMonthlyEarnings = 17712; // 2024 threshold
        const cappedAmount = Math.min(grossAmount, maxMonthlyEarnings);
        withholdingAmount = cappedAmount * 0.01;
        break;

      default:
        throw new BadRequestException(`Unknown withholding type: ${withholdingType}`);
    }

    const netAmount = grossAmount - withholdingAmount;

    return {
      withholdingAmount: Math.round(withholdingAmount * 100) / 100,
      netAmount: Math.round(netAmount * 100) / 100,
    };
  }

  async create(
    organizationId: string,
    userId: string,
    dto: CreateWithholdingDto,
  ): Promise<WithholdingResponseDto> {
    // Verify contractor exists and belongs to organization
    const contractor = await this.prisma.contractor.findFirst({
      where: {
        id: dto.contractorId,
        supplier: {
          organizationId,
        },
      },
      include: {
        supplier: true,
      },
    });

    if (!contractor) {
      throw new NotFoundException(
        'Contractor not found in your organization',
      );
    }

    // Verify tax classification exists
    const taxClassification = await this.prisma.contractorTaxClassification.findUnique({
      where: {
        id: dto.taxClassificationId,
      },
    });

    if (!taxClassification) {
      throw new NotFoundException('Tax classification not found');
    }

    if (taxClassification.contractorId !== dto.contractorId) {
      throw new BadRequestException(
        'Tax classification does not belong to this contractor',
      );
    }

    // Validate dates
    const effectiveDate = new Date(dto.effectiveDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : undefined;

    if (endDate && endDate <= effectiveDate) {
      throw new BadRequestException('End date must be after effective date');
    }

    // Calculate net amount
    const netAmount = dto.grossAmount - dto.withholdingAmount;

    // Generate instruction number
    const year = new Date().getFullYear();
    const count = await this.prisma.withholdingInstruction.count({
      where: { organizationId },
    });
    const instructionNumber = `WH-${year}-${String(count + 1).padStart(6, '0')}`;

    // Build worker name
    const workerName = `${contractor.firstName} ${contractor.lastName}`;

    // Build supplier name
    const supplierName =
      contractor.supplier.companyName ||
      `${contractor.supplier.firstName} ${contractor.supplier.lastName}`;

    const withholdingInstruction = await this.prisma.withholdingInstruction.create({
      data: {
        organizationId,
        contractorId: dto.contractorId,
        taxClassificationId: dto.taxClassificationId,
        instructionNumber,
        effectiveDate,
        endDate,
        workerExternalId: dto.workerExternalId,
        workerName,
        workerTaxNumber: contractor.taxNumber,
        supplierName,
        supplierTaxNumber: contractor.supplier.taxNumber,
        withholdingType: dto.withholdingType,
        taxYear: dto.taxYear,
        grossAmount: new Decimal(dto.grossAmount),
        withholdingAmount: new Decimal(dto.withholdingAmount),
        netAmount: new Decimal(netAmount),
        currency: dto.currency || 'ZAR',
        classification: dto.classification,
        riskScore: dto.riskScore,
        dominantImpression: dto.dominantImpression,
        canonicalPayload: dto.canonicalPayload,
        adapterType: dto.adapterType,
        syncStatus: 'PENDING',
        retryCount: 0,
        createdBy: userId,
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
    });

    return withholdingInstruction as any;
  }

  async findAll(
    organizationId: string,
    query: QueryWithholdingDto,
  ): Promise<PaginatedWithholdingResponseDto> {
    const {
      contractorId,
      withholdingType,
      classification,
      syncStatus,
      effectiveDateFrom,
      effectiveDateTo,
      taxYear,
      page = 1,
      limit = 20,
    } = query;

    const where: any = {
      organizationId,
    };

    if (contractorId) {
      where.contractorId = contractorId;
    }

    if (withholdingType) {
      where.withholdingType = withholdingType;
    }

    if (classification) {
      where.classification = classification;
    }

    if (syncStatus) {
      where.syncStatus = syncStatus;
    }

    if (effectiveDateFrom) {
      where.effectiveDate = { gte: new Date(effectiveDateFrom) };
    }

    if (effectiveDateTo) {
      where.effectiveDate = {
        ...where.effectiveDate,
        lte: new Date(effectiveDateTo),
      };
    }

    if (taxYear) {
      where.taxYear = taxYear;
    }

    const [instructions, total] = await Promise.all([
      this.prisma.withholdingInstruction.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
      this.prisma.withholdingInstruction.count({ where }),
    ]);

    return {
      data: instructions as any,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(
    organizationId: string,
    id: string,
  ): Promise<WithholdingResponseDto> {
    const instruction = await this.prisma.withholdingInstruction.findFirst({
      where: {
        id,
        organizationId,
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
    });

    if (!instruction) {
      throw new NotFoundException('Withholding instruction not found');
    }

    return instruction as any;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateWithholdingDto,
  ): Promise<WithholdingResponseDto> {
    // Check if instruction exists and belongs to organization
    const existingInstruction = await this.prisma.withholdingInstruction.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!existingInstruction) {
      throw new NotFoundException('Withholding instruction not found');
    }

    // Validate dates if being updated
    const effectiveDate = dto.effectiveDate
      ? new Date(dto.effectiveDate)
      : existingInstruction.effectiveDate;
    const endDate = dto.endDate
      ? new Date(dto.endDate)
      : existingInstruction.endDate;

    if (endDate && endDate <= effectiveDate) {
      throw new BadRequestException('End date must be after effective date');
    }

    // Calculate net amount if amounts changed
    let netAmount = existingInstruction.netAmount;
    if (dto.grossAmount !== undefined || dto.withholdingAmount !== undefined) {
      const gross = dto.grossAmount ?? Number(existingInstruction.grossAmount);
      const withholding = dto.withholdingAmount ?? Number(existingInstruction.withholdingAmount);
      netAmount = new Decimal(gross - withholding);
    }

    const instruction = await this.prisma.withholdingInstruction.update({
      where: { id },
      data: {
        effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        workerExternalId: dto.workerExternalId,
        withholdingType: dto.withholdingType,
        taxYear: dto.taxYear,
        grossAmount: dto.grossAmount ? new Decimal(dto.grossAmount) : undefined,
        withholdingAmount: dto.withholdingAmount
          ? new Decimal(dto.withholdingAmount)
          : undefined,
        netAmount: dto.grossAmount !== undefined || dto.withholdingAmount !== undefined
          ? netAmount
          : undefined,
        currency: dto.currency,
        classification: dto.classification,
        riskScore: dto.riskScore,
        dominantImpression: dto.dominantImpression,
        canonicalPayload: dto.canonicalPayload,
        adapterType: dto.adapterType,
        externalReference: dto.externalReference,
        syncStatus: dto.syncStatus,
        syncedAt: dto.syncedAt ? new Date(dto.syncedAt) : undefined,
        syncError: dto.syncError,
        retryCount: dto.retryCount,
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
    });

    return instruction as any;
  }

  async remove(organizationId: string, id: string): Promise<void> {
    const instruction = await this.prisma.withholdingInstruction.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!instruction) {
      throw new NotFoundException('Withholding instruction not found');
    }

    // Only allow deletion if not synced
    if (instruction.syncStatus === 'SYNCED') {
      throw new BadRequestException(
        'Cannot delete synced withholding instruction',
      );
    }

    await this.prisma.withholdingInstruction.delete({
      where: { id },
    });
  }

  async markSynced(
    organizationId: string,
    id: string,
    externalReference: string,
  ): Promise<WithholdingResponseDto> {
    const instruction = await this.prisma.withholdingInstruction.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!instruction) {
      throw new NotFoundException('Withholding instruction not found');
    }

    return this.prisma.withholdingInstruction.update({
      where: { id },
      data: {
        syncStatus: 'SYNCED',
        syncedAt: new Date(),
        externalReference,
        syncError: null,
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

  async markFailed(
    organizationId: string,
    id: string,
    error: string,
  ): Promise<WithholdingResponseDto> {
    const instruction = await this.prisma.withholdingInstruction.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!instruction) {
      throw new NotFoundException('Withholding instruction not found');
    }

    return this.prisma.withholdingInstruction.update({
      where: { id },
      data: {
        syncStatus: 'FAILED',
        syncError: error,
        retryCount: { increment: 1 },
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
