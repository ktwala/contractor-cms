import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SponsorAccountabilityStatus } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { HcmSponsorLookupService } from '../../core/hcm/hcm-sponsor-lookup.service';
import { CreateEngagementDto } from './dto/create-engagement.dto';
import { UpdateEngagementDto } from './dto/update-engagement.dto';
import { QueryEngagementDto } from './dto/query-engagement.dto';
import {
  PaginatedEngagementResponseDto,
  EngagementResponseDto,
} from './dto/engagement-response.dto';

const ENGAGEMENT_CONTRACTOR_SELECT_CORE = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  externalPersonId: true,
  personType: true,
  supplierResourceId: true,
  accessIntent: true,
  identityRequired: true,
  physicalAccessRequired: true,
  logicalAccessRequired: true,
  igaIntegrationStatus: true,
  accessEnablementStatus: true,
  igaLastSyncAt: true,
  riskTier: true,
  workerArchetype: true,
} as const;

const ENGAGEMENT_CONTRACTOR_SELECT_WITH_SUPPLIER = {
  ...ENGAGEMENT_CONTRACTOR_SELECT_CORE,
  supplier: {
    select: {
      id: true,
      companyName: true,
      firstName: true,
      lastName: true,
    },
  },
} as const;

@Injectable()
export class EngagementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hcmSponsorLookup: HcmSponsorLookupService,
  ) {}

  /**
   * PR-SPONSOR-GOVERNANCE-1 — structural sponsor accountability baseline (no HCM / attestation).
   * - Primary sponsor id cleared ⇒ clear delegate + status.
   * - `sponsorStatus` without primary sponsor id ⇒ 400.
   * - Primary sponsor id present with null/omitted status ⇒ default `SPONSOR_ASSIGNED`.
   */
  private normalizeSponsorAccountability(
    dto: {
      sponsorEmployeeId?: string | null;
      sponsorDelegateEmployeeId?: string | null;
      sponsorStatus?: SponsorAccountabilityStatus | null;
    },
    existing: {
      sponsorEmployeeId: string | null;
      sponsorDelegateEmployeeId: string | null;
      sponsorStatus: SponsorAccountabilityStatus | null;
    } | null,
  ): {
    sponsorEmployeeId: string | null;
    sponsorDelegateEmployeeId: string | null;
    sponsorStatus: SponsorAccountabilityStatus | null;
  } {
    const trimId = (v: string | null | undefined): string | null => {
      if (v === undefined || v === null) return null;
      const t = String(v).trim();
      return t === '' ? null : t;
    };

    const finalEmp =
      dto.sponsorEmployeeId !== undefined
        ? trimId(dto.sponsorEmployeeId)
        : existing?.sponsorEmployeeId ?? null;
    const finalDel =
      dto.sponsorDelegateEmployeeId !== undefined
        ? trimId(dto.sponsorDelegateEmployeeId)
        : existing?.sponsorDelegateEmployeeId ?? null;

    if (dto.sponsorEmployeeId !== undefined && finalEmp === null) {
      return {
        sponsorEmployeeId: null,
        sponsorDelegateEmployeeId: null,
        sponsorStatus: null,
      };
    }

    let finalStat: SponsorAccountabilityStatus | null =
      dto.sponsorStatus !== undefined
        ? dto.sponsorStatus
        : existing?.sponsorStatus ?? null;

    if (finalStat != null && finalEmp == null) {
      throw new BadRequestException(
        'sponsorStatus requires sponsorEmployeeId (primary sponsor accountability)',
      );
    }

    if (finalEmp != null && finalStat == null) {
      finalStat = SponsorAccountabilityStatus.SPONSOR_ASSIGNED;
    }

    return {
      sponsorEmployeeId: finalEmp,
      sponsorDelegateEmployeeId: finalDel,
      sponsorStatus: finalStat,
    };
  }

  async create(
    organizationId: string,
    createEngagementDto: CreateEngagementDto,
  ): Promise<EngagementResponseDto> {
    // Verify contractor exists and belongs to organization
    const contractor = await this.prisma.contractor.findFirst({
      where: {
        id: createEngagementDto.contractorId,
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

    // Verify contract exists and belongs to organization
    const contract = await this.prisma.supplierContract.findFirst({
      where: {
        id: createEngagementDto.contractId,
        organizationId,
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found in your organization');
    }

    // Verify project exists and belongs to organization (if provided)
    if (createEngagementDto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: {
          id: createEngagementDto.projectId,
          organizationId,
        },
      });

      if (!project) {
        throw new NotFoundException('Project not found in your organization');
      }
    }

    // Validate dates
    const startDate = new Date(createEngagementDto.startDate);
    const endDate = createEngagementDto.endDate
      ? new Date(createEngagementDto.endDate)
      : undefined;

    if (endDate && endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    // Verify contractor is active
    if (!contractor.isActive) {
      throw new BadRequestException(
        'Cannot create engagement for inactive contractor',
      );
    }

    // Verify contract is active
    if (contract.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Cannot create engagement for non-active contract',
      );
    }

    const sponsor = this.normalizeSponsorAccountability(
      {
        sponsorEmployeeId: createEngagementDto.sponsorEmployeeId,
        sponsorDelegateEmployeeId: createEngagementDto.sponsorDelegateEmployeeId,
        sponsorStatus: createEngagementDto.sponsorStatus,
      },
      null,
    );

    await this.hcmSponsorLookup.assertSponsorReferencesAllowed(organizationId, {
      sponsorEmployeeId: sponsor.sponsorEmployeeId,
      sponsorDelegateEmployeeId: sponsor.sponsorDelegateEmployeeId,
    });

    const engagement = await this.prisma.contractorEngagement.create({
      data: {
        contractorId: createEngagementDto.contractorId,
        contractId: createEngagementDto.contractId,
        projectId: createEngagementDto.projectId,
        costCenterId: createEngagementDto.costCenterId,
        role: createEngagementDto.role,
        startDate,
        endDate,
        rateType: createEngagementDto.rateType,
        rateAmount: createEngagementDto.rateAmount,
        currency: createEngagementDto.currency || 'ZAR',
        isActive: true,
        sponsorEmployeeId: sponsor.sponsorEmployeeId,
        sponsorDelegateEmployeeId: sponsor.sponsorDelegateEmployeeId,
        sponsorStatus: sponsor.sponsorStatus,
      },
      include: {
        contractor: {
          select: ENGAGEMENT_CONTRACTOR_SELECT_CORE,
        },
        contract: {
          select: {
            id: true,
            contractNumber: true,
            title: true,
          },
        },
        project: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    return engagement as any;
  }

  async findAll(
    organizationId: string,
    query: QueryEngagementDto,
  ): Promise<PaginatedEngagementResponseDto> {
    const {
      search,
      contractorId,
      contractId,
      projectId,
      rateType,
      isActive,
      role,
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

    if (search) {
      where.OR = [
        { role: { contains: search, mode: 'insensitive' } },
        {
          contractor: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    if (contractorId) {
      where.contractorId = contractorId;
    }

    if (contractId) {
      where.contractId = contractId;
    }

    if (projectId) {
      where.projectId = projectId;
    }

    if (rateType) {
      where.rateType = rateType;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (role) {
      where.role = { contains: role, mode: 'insensitive' };
    }

    const [engagements, total] = await Promise.all([
      this.prisma.contractorEngagement.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          contractor: {
            select: ENGAGEMENT_CONTRACTOR_SELECT_CORE,
          },
          contract: {
            select: {
              id: true,
              contractNumber: true,
              title: true,
            },
          },
          project: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.contractorEngagement.count({ where }),
    ]);

    return {
      data: engagements as any,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(
    organizationId: string,
    id: string,
  ): Promise<EngagementResponseDto> {
    const engagement = await this.prisma.contractorEngagement.findFirst({
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
          select: ENGAGEMENT_CONTRACTOR_SELECT_WITH_SUPPLIER,
        },
        contract: {
          select: {
            id: true,
            contractNumber: true,
            title: true,
            contractType: true,
            status: true,
          },
        },
        project: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
          },
        },
      },
    });

    if (!engagement) {
      throw new NotFoundException('Engagement not found');
    }

    return engagement as any;
  }

  async update(
    organizationId: string,
    id: string,
    updateEngagementDto: UpdateEngagementDto,
  ): Promise<EngagementResponseDto> {
    // Check if engagement exists and belongs to organization
    const existingEngagement = await this.prisma.contractorEngagement.findFirst(
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

    if (!existingEngagement) {
      throw new NotFoundException('Engagement not found');
    }

    // If changing contractor, verify new contractor belongs to organization
    if (
      updateEngagementDto.contractorId &&
      updateEngagementDto.contractorId !== existingEngagement.contractorId
    ) {
      const newContractor = await this.prisma.contractor.findFirst({
        where: {
          id: updateEngagementDto.contractorId,
          supplier: {
            organizationId,
          },
        },
      });

      if (!newContractor) {
        throw new NotFoundException(
          'New contractor not found in your organization',
        );
      }
    }

    // If changing contract, verify new contract belongs to organization
    if (
      updateEngagementDto.contractId &&
      updateEngagementDto.contractId !== existingEngagement.contractId
    ) {
      const newContract = await this.prisma.supplierContract.findFirst({
        where: {
          id: updateEngagementDto.contractId,
          organizationId,
        },
      });

      if (!newContract) {
        throw new NotFoundException(
          'New contract not found in your organization',
        );
      }
    }

    // If changing project, verify new project belongs to organization
    if (updateEngagementDto.projectId) {
      const newProject = await this.prisma.project.findFirst({
        where: {
          id: updateEngagementDto.projectId,
          organizationId,
        },
      });

      if (!newProject) {
        throw new NotFoundException(
          'New project not found in your organization',
        );
      }
    }

    // Validate dates if being updated
    const startDate = updateEngagementDto.startDate
      ? new Date(updateEngagementDto.startDate)
      : existingEngagement.startDate;
    const endDate = updateEngagementDto.endDate
      ? new Date(updateEngagementDto.endDate)
      : existingEngagement.endDate;

    if (endDate && endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    const {
      sponsorEmployeeId,
      sponsorDelegateEmployeeId,
      sponsorStatus,
      startDate: patchStart,
      endDate: patchEnd,
      ...restPatch
    } = updateEngagementDto;

    const sponsorTouched =
      sponsorEmployeeId !== undefined ||
      sponsorDelegateEmployeeId !== undefined ||
      sponsorStatus !== undefined;

    const sponsorData = sponsorTouched
      ? this.normalizeSponsorAccountability(
          { sponsorEmployeeId, sponsorDelegateEmployeeId, sponsorStatus },
          {
            sponsorEmployeeId: existingEngagement.sponsorEmployeeId,
            sponsorDelegateEmployeeId: existingEngagement.sponsorDelegateEmployeeId,
            sponsorStatus: existingEngagement.sponsorStatus,
          },
        )
      : null;

    if (sponsorData) {
      await this.hcmSponsorLookup.assertSponsorReferencesAllowed(organizationId, {
        sponsorEmployeeId: sponsorData.sponsorEmployeeId,
        sponsorDelegateEmployeeId: sponsorData.sponsorDelegateEmployeeId,
      });
    }

    const engagement = await this.prisma.contractorEngagement.update({
      where: { id },
      data: {
        ...restPatch,
        startDate: patchStart ? new Date(patchStart) : undefined,
        endDate: patchEnd ? new Date(patchEnd) : undefined,
        ...(sponsorData ?? {}),
      },
      include: {
        contractor: {
          select: ENGAGEMENT_CONTRACTOR_SELECT_CORE,
        },
        contract: {
          select: {
            id: true,
            contractNumber: true,
            title: true,
          },
        },
        project: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    return engagement as any;
  }

  async remove(organizationId: string, id: string): Promise<void> {
    const engagement = await this.prisma.contractorEngagement.findFirst({
      where: {
        id,
        contractor: {
          supplier: {
            organizationId,
          },
        },
      },
    });

    if (!engagement) {
      throw new NotFoundException('Engagement not found');
    }

    // Only allow deletion if engagement hasn't started yet or is inactive
    const now = new Date();
    if (engagement.startDate <= now && engagement.isActive) {
      throw new BadRequestException(
        'Cannot delete active or past engagement. Please deactivate it instead.',
      );
    }

    await this.prisma.contractorEngagement.delete({
      where: { id },
    });
  }

  async deactivate(
    organizationId: string,
    id: string,
  ): Promise<EngagementResponseDto> {
    const engagement = await this.prisma.contractorEngagement.findFirst({
      where: {
        id,
        contractor: {
          supplier: {
            organizationId,
          },
        },
      },
    });

    if (!engagement) {
      throw new NotFoundException('Engagement not found');
    }

    return this.prisma.contractorEngagement.update({
      where: { id },
      data: { isActive: false },
      include: {
        contractor: {
          select: ENGAGEMENT_CONTRACTOR_SELECT_CORE,
        },
        contract: {
          select: {
            id: true,
            contractNumber: true,
            title: true,
          },
        },
        project: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    }) as any;
  }
}
