import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ResponsibleManagerAccountabilityStatus } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { HcmResponsibleManagerLookupService } from '../../core/hcm/hcm-responsible-manager-lookup.service';
import { toIgaEventContractorSlice } from '../../core/iga/iga-event.mapper';
import { AccessIntegrationPublishService } from '../access-integration/access-integration-publish.service';
import { shouldEmitSponsorAssignedEvent } from '../../core/iga/iga-workforce-event-writer.service';
import { CreateEngagementDto } from './dto/create-engagement.dto';
import { UpdateEngagementDto } from './dto/update-engagement.dto';
import { QueryEngagementDto } from './dto/query-engagement.dto';
import {
  PaginatedEngagementResponseDto,
  EngagementResponseDto,
} from './dto/engagement-response.dto';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { applyResponsibleManagerEngagementScope } from '../../core/auth/utils/responsible-manager-scope.helper';

const ENGAGEMENT_CONTRACTOR_SELECT_CORE = {
  id: true,
  supplierId: true,
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
    private readonly hcmResponsibleManagerLookup: HcmResponsibleManagerLookupService,
    private readonly accessIntegrationPublish: AccessIntegrationPublishService,
  ) {}

  /** Tenant filter for list/read; omitted when actor has global access (PR-ENGAGEMENTS-ADMIN-500-1). */
  private engagementTenantWhere(
    accessContext: AccessContext,
  ): Record<string, unknown> {
    if (accessContext.isGlobalAccess) {
      return {};
    }
    if (!accessContext.targetOrganizationId) {
      throw new BadRequestException('Organization context is required');
    }
    return {
      contractor: {
        supplier: {
          organizationId: accessContext.targetOrganizationId,
        },
      },
    };
  }

  /**
   * PR-SPONSOR-GOVERNANCE-1 — structural sponsor accountability baseline (no HCM / attestation).
   * - Primary sponsor id cleared ⇒ clear delegate + status.
   * - `responsibleManagerStatus` without primary sponsor id ⇒ 400.
   * - Primary sponsor id present with null/omitted status ⇒ default `RESPONSIBLE_MANAGER_ASSIGNED`.
   */
  private normalizeResponsibleManagerAccountability(
    dto: {
      responsibleManagerEmployeeId?: string | null;
      responsibleManagerDelegateEmployeeId?: string | null;
      responsibleManagerStatus?: ResponsibleManagerAccountabilityStatus | null;
    },
    existing: {
      responsibleManagerEmployeeId: string | null;
      responsibleManagerDelegateEmployeeId: string | null;
      responsibleManagerStatus: ResponsibleManagerAccountabilityStatus | null;
    } | null,
  ): {
    responsibleManagerEmployeeId: string | null;
    responsibleManagerDelegateEmployeeId: string | null;
    responsibleManagerStatus: ResponsibleManagerAccountabilityStatus | null;
  } {
    const trimId = (v: string | null | undefined): string | null => {
      if (v === undefined || v === null) return null;
      const t = String(v).trim();
      return t === '' ? null : t;
    };

    const finalEmp =
      dto.responsibleManagerEmployeeId !== undefined
        ? trimId(dto.responsibleManagerEmployeeId)
        : existing?.responsibleManagerEmployeeId ?? null;
    const finalDel =
      dto.responsibleManagerDelegateEmployeeId !== undefined
        ? trimId(dto.responsibleManagerDelegateEmployeeId)
        : existing?.responsibleManagerDelegateEmployeeId ?? null;

    if (dto.responsibleManagerEmployeeId !== undefined && finalEmp === null) {
      return {
        responsibleManagerEmployeeId: null,
        responsibleManagerDelegateEmployeeId: null,
        responsibleManagerStatus: null,
      };
    }

    let finalStat: ResponsibleManagerAccountabilityStatus | null =
      dto.responsibleManagerStatus !== undefined
        ? dto.responsibleManagerStatus
        : existing?.responsibleManagerStatus ?? null;

    if (finalStat != null && finalEmp == null) {
      throw new BadRequestException(
        'responsibleManagerStatus requires responsibleManagerEmployeeId (primary sponsor accountability)',
      );
    }

    if (finalEmp != null && finalStat == null) {
      finalStat = ResponsibleManagerAccountabilityStatus.RESPONSIBLE_MANAGER_ASSIGNED;
    }

    return {
      responsibleManagerEmployeeId: finalEmp,
      responsibleManagerDelegateEmployeeId: finalDel,
      responsibleManagerStatus: finalStat,
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

    const sponsor = this.normalizeResponsibleManagerAccountability(
      {
        responsibleManagerEmployeeId: createEngagementDto.responsibleManagerEmployeeId,
        responsibleManagerDelegateEmployeeId: createEngagementDto.responsibleManagerDelegateEmployeeId,
        responsibleManagerStatus: createEngagementDto.responsibleManagerStatus,
      },
      null,
    );

    await this.hcmResponsibleManagerLookup.assertResponsibleManagerReferencesAllowed(organizationId, {
      responsibleManagerEmployeeId: sponsor.responsibleManagerEmployeeId,
      responsibleManagerDelegateEmployeeId: sponsor.responsibleManagerDelegateEmployeeId,
    });

    const emitSponsorAssigned = shouldEmitSponsorAssignedEvent(
      null,
      sponsor.responsibleManagerEmployeeId,
    );

    const engagement = await this.prisma.$transaction(async (tx) => {
      const created = await tx.contractorEngagement.create({
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
          responsibleManagerEmployeeId: sponsor.responsibleManagerEmployeeId,
          responsibleManagerDelegateEmployeeId: sponsor.responsibleManagerDelegateEmployeeId,
          responsibleManagerStatus: sponsor.responsibleManagerStatus,
        },
      });

      if (emitSponsorAssigned && sponsor.responsibleManagerEmployeeId) {
        const contractorRow = await tx.contractor.findUniqueOrThrow({
          where: { id: created.contractorId },
        });
        await this.accessIntegrationPublish.publishSponsorAssigned(
          toIgaEventContractorSlice(contractorRow),
          {
            id: created.id,
            responsibleManagerEmployeeId: sponsor.responsibleManagerEmployeeId,
            responsibleManagerStatus: sponsor.responsibleManagerStatus,
          },
          organizationId,
          tx,
        );
      }

      return tx.contractorEngagement.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          contractor: { select: ENGAGEMENT_CONTRACTOR_SELECT_CORE },
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
    });

    return engagement as any;
  }

  async findAll(
    accessContext: AccessContext,
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
      ...this.engagementTenantWhere(accessContext),
    };
    applyResponsibleManagerEngagementScope(where, accessContext);

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
    accessContext: AccessContext,
    id: string,
  ): Promise<EngagementResponseDto> {
    const where: Record<string, unknown> = {
      id,
      ...this.engagementTenantWhere(accessContext),
    };
    applyResponsibleManagerEngagementScope(where, accessContext);

    const engagement = await this.prisma.contractorEngagement.findFirst({
      where,
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
    accessContext: AccessContext,
    organizationId: string,
    id: string,
    updateEngagementDto: UpdateEngagementDto,
  ): Promise<EngagementResponseDto> {
    await this.findOne(accessContext, id);
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
      responsibleManagerEmployeeId,
      responsibleManagerDelegateEmployeeId,
      responsibleManagerStatus,
      startDate: patchStart,
      endDate: patchEnd,
      ...restPatch
    } = updateEngagementDto;

    const sponsorTouched =
      responsibleManagerEmployeeId !== undefined ||
      responsibleManagerDelegateEmployeeId !== undefined ||
      responsibleManagerStatus !== undefined;

    const sponsorData = sponsorTouched
      ? this.normalizeResponsibleManagerAccountability(
          { responsibleManagerEmployeeId, responsibleManagerDelegateEmployeeId, responsibleManagerStatus },
          {
            responsibleManagerEmployeeId: existingEngagement.responsibleManagerEmployeeId,
            responsibleManagerDelegateEmployeeId: existingEngagement.responsibleManagerDelegateEmployeeId,
            responsibleManagerStatus: existingEngagement.responsibleManagerStatus,
          },
        )
      : null;

    if (sponsorData) {
      await this.hcmResponsibleManagerLookup.assertResponsibleManagerReferencesAllowed(organizationId, {
        responsibleManagerEmployeeId: sponsorData.responsibleManagerEmployeeId,
        responsibleManagerDelegateEmployeeId: sponsorData.responsibleManagerDelegateEmployeeId,
      });
    }

    const emitSponsorAssigned =
      sponsorData != null &&
      shouldEmitSponsorAssignedEvent(
        existingEngagement.responsibleManagerEmployeeId,
        sponsorData.responsibleManagerEmployeeId,
      );

    const engagement = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.contractorEngagement.update({
        where: { id },
        data: {
          ...restPatch,
          startDate: patchStart ? new Date(patchStart) : undefined,
          endDate: patchEnd ? new Date(patchEnd) : undefined,
          ...(sponsorData ?? {}),
        },
      });

      if (emitSponsorAssigned && sponsorData?.responsibleManagerEmployeeId) {
        const contractorRow = await tx.contractor.findUniqueOrThrow({
          where: { id: updated.contractorId },
        });
        await this.accessIntegrationPublish.publishSponsorAssigned(
          toIgaEventContractorSlice(contractorRow),
          {
            id: updated.id,
            responsibleManagerEmployeeId: sponsorData.responsibleManagerEmployeeId,
            responsibleManagerStatus: sponsorData.responsibleManagerStatus,
          },
          organizationId,
          tx,
        );
      }

      return tx.contractorEngagement.findUniqueOrThrow({
        where: { id: updated.id },
        include: {
          contractor: { select: ENGAGEMENT_CONTRACTOR_SELECT_CORE },
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
