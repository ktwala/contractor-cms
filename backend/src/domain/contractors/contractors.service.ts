import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateContractorDto } from './dto/create-contractor.dto';
import { NominateContractorDto } from './dto/nominate-contractor.dto';
import { UpdateContractorDto } from './dto/update-contractor.dto';
import { QueryContractorDto } from './dto/query-contractor.dto';
import { QueryContractorWorkforceReviewDto } from './dto/query-contractor-workforce-review.dto';
import {
  ContractorWorkforceReviewQueueItemDto,
  ContractorWorkforceReviewQueueResponseDto,
} from './dto/contractor-workforce-review-queue.dto';
import { ContractorWorkforceTimelineResponseDto } from './dto/contractor-workforce-timeline.dto';
import {
  PaginatedContractorResponseDto,
  ContractorResponseDto,
} from './dto/contractor-response.dto';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { applyResponsibleManagerContractorScope } from '../../core/auth/utils/responsible-manager-scope.helper';
import { excludeComparisonAnchorContractorsWhere } from '../demo/connector-demo-comparison.constants';
import { assertSupplierOperationalTrustGranted } from '../suppliers/supplier-operational-trust.util';
import { AuditService } from '../../core/audit/audit.service';
import { toIgaEventContractorSlice } from '../../core/iga/iga-event.mapper';
import { AccessIntegrationPublishService } from '../access-integration/access-integration-publish.service';
import { ContractorWorkforceStateService } from './contractor-workforce-state.service';
import { ContractorWorkforceEventPublisherService } from './contractor-workforce-event-publisher.service';
import { ContractorWorkforceHistoryService } from './contractor-workforce-history.service';
import {
  ContractorWorkforceHistorySource,
  ContractorWorkforceState,
  ResponsibleManagerAccountabilityStatus,
  SupplierStatus,
} from '@prisma/client';
import {
  SUPPLIER_CHANNEL_ACQUISITION_MODEL,
  INDEPENDENT_CHANNEL_ACQUISITION_MODEL,
  assertIndependentChannelNotSupplierScoped,
} from './acquisition-model.constants';
import { AcquireIndependentContractorDto } from './dto/acquire-independent-contractor.dto';
import { applyContractorOrganizationScope } from './contractor-org-scope.helper';
import { HcmResponsibleManagerLookupService } from '../../core/hcm/hcm-responsible-manager-lookup.service';
import { permissionSatisfied } from '../../core/auth/utils/permission-evaluation';
import { PERMISSIONS } from '../../core/auth/permissions.constants';
import {
  canTransitionToBlacklisted,
  deriveIsActiveFromWorkforceState,
  resolveOpsReviewNextTargetState,
  WORKFORCE_OPS_REVIEW_STATES,
} from './contractor-workforce-state.constants';

@Injectable()
export class ContractorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly accessIntegrationPublish: AccessIntegrationPublishService,
    private readonly workforceStateService: ContractorWorkforceStateService,
    private readonly workforceEventPublisher: ContractorWorkforceEventPublisherService,
    private readonly workforceHistory: ContractorWorkforceHistoryService,
    private readonly hcmResponsibleManagerLookup: HcmResponsibleManagerLookupService,
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

    assertSupplierOperationalTrustGranted({
      status: supplier.status,
      supplierName: supplier.tradingName ?? supplier.companyName ?? undefined,
    });

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

    const { sponsorNote, ...restDto } = createContractorDto;
    const initialWorkforceState = ContractorWorkforceState.ACTIVE;

    const contractor = await this.prisma.$transaction(async (tx) => {
      const created = await tx.contractor.create({
        data: {
          ...restDto,
          organizationId: targetOrgId,
          acquisitionModel: SUPPLIER_CHANNEL_ACQUISITION_MODEL,
          workforceState: initialWorkforceState,
          isActive: deriveIsActiveFromWorkforceState(initialWorkforceState),
          skills: restDto.skills || [],
          dateOfBirth: restDto.dateOfBirth
            ? new Date(restDto.dateOfBirth)
            : undefined,
          accessExpiresAt: restDto.accessExpiresAt
            ? new Date(restDto.accessExpiresAt)
            : undefined,
        },
      });

      await this.workforceHistory.recordTransition({
        tx,
        contractorId: created.id,
        organizationId: targetOrgId,
        fromState: null,
        toState: initialWorkforceState,
        actorUserId: accessContext.actorUserId,
        reason: sponsorNote ?? null,
        source: ContractorWorkforceHistorySource.OPS,
        metadata: {
          supplierId: createContractorDto.supplierId,
          bootstrap: true,
          platformDirectCreate: true,
        },
      });

      await this.accessIntegrationPublish.publishExternalPersonCreated(
        toIgaEventContractorSlice(created),
        targetOrgId,
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

    // PR-CTR-CMS-AUTHORITY-1 — platform-native creation provenance.
    // EWP is the external-worker authority after bootstrap. This event distinguishes contractors
    // created directly in the platform from those materialized via HCM import.
    // missingResponsibleManagerAtCreation=true signals that a governance scan will raise MISSING_RESPONSIBLE_MANAGER
    // until the operator assigns a sponsor via an engagement.
    const hasLegacySource = !!(contractor as any).legacySourcePersonId;
    if (!hasLegacySource) {
      const hasActiveResponsibleManagerEngagement = await this.prisma.contractorEngagement.findFirst({
        where: {
          contractorId: contractor.id,
          isActive: true,
          responsibleManagerEmployeeId: { not: null },
        },
      });
      await this.auditService.logAction(
        accessContext.actorUserId,
        'CONTRACTOR_CREATED_IN_CMS',
        'Contractor',
        contractor.id,
        null,
        null,
        {
          organizationId: targetOrgId,
          metadata: {
            missingResponsibleManagerAtCreation: !hasActiveResponsibleManagerEngagement,
            workerClassification: (contractor as any).workerClassification,
            engagementModel: (contractor as any).engagementModel,
            sponsorNote: sponsorNote ?? null,
          },
        }
      );
    }

    return contractor as any;
  }

  /**
   * PR-WORKFORCE-NOMINATE-1 — supplier-backed workforce intake at NOMINATED.
   * Nomination is not onboarding; it is the first workforce-state entry point.
   */
  async nominate(
    accessContext: AccessContext,
    dto: NominateContractorDto,
  ): Promise<ContractorResponseDto> {
    const targetOrgId = accessContext.targetOrganizationId;
    if (!targetOrgId) throw new BadRequestException('Organization context is required');

    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: dto.supplierId,
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

    const existingContractor = await this.prisma.contractor.findFirst({
      where: {
        supplierId: dto.supplierId,
        email: dto.email,
      },
    });

    if (existingContractor) {
      throw new ConflictException(
        'A contractor with this email already exists for this supplier',
      );
    }

    const contract = await this.prisma.supplierContract.findFirst({
      where: {
        id: dto.engagement.contractId,
        organizationId: targetOrgId,
        supplierId: dto.supplierId,
      },
    });

    if (!contract) {
      throw new NotFoundException(
        'Contract not found for this supplier in your organization',
      );
    }

    if (contract.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Cannot nominate against a non-active contract',
      );
    }

    if (dto.engagement.projectId) {
      const project = await this.prisma.project.findFirst({
        where: {
          id: dto.engagement.projectId,
          organizationId: targetOrgId,
        },
      });

      if (!project) {
        throw new NotFoundException('Project not found in your organization');
      }
    }

    const startDate = new Date(dto.engagement.startDate);
    const endDate = dto.engagement.endDate
      ? new Date(dto.engagement.endDate)
      : undefined;

    if (endDate && endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    const sponsor = this.normalizeNominationResponsibleManager(dto.engagement);

    await this.hcmResponsibleManagerLookup.assertResponsibleManagerReferencesAllowed(targetOrgId, {
      responsibleManagerEmployeeId: sponsor.responsibleManagerEmployeeId,
      responsibleManagerDelegateEmployeeId: sponsor.responsibleManagerDelegateEmployeeId,
    });

    const { sponsorNote, nominationReason, engagement, ...restDto } = dto;
    const initialWorkforceState = ContractorWorkforceState.NOMINATED;

    const contractor = await this.prisma.$transaction(async (tx) => {
      const created = await tx.contractor.create({
        data: {
          ...restDto,
          organizationId: targetOrgId,
          acquisitionModel: SUPPLIER_CHANNEL_ACQUISITION_MODEL,
          workforceState: initialWorkforceState,
          isActive: deriveIsActiveFromWorkforceState(initialWorkforceState),
          skills: restDto.skills || [],
          dateOfBirth: restDto.dateOfBirth ? new Date(restDto.dateOfBirth) : undefined,
          accessExpiresAt: restDto.accessExpiresAt
            ? new Date(restDto.accessExpiresAt)
            : undefined,
        },
      });

      const createdEngagement = await tx.contractorEngagement.create({
        data: {
          contractorId: created.id,
          contractId: engagement.contractId,
          projectId: engagement.projectId,
          costCenterId: engagement.costCenterId,
          role: engagement.role,
          startDate,
          endDate,
          rateType: engagement.rateType,
          rateAmount: engagement.rateAmount,
          currency: engagement.currency || 'ZAR',
          isActive: true,
          responsibleManagerEmployeeId: sponsor.responsibleManagerEmployeeId,
          responsibleManagerDelegateEmployeeId: sponsor.responsibleManagerDelegateEmployeeId,
          responsibleManagerStatus: sponsor.responsibleManagerStatus,
        },
      });

      await this.accessIntegrationPublish.publishExternalPersonCreated(
        toIgaEventContractorSlice(created),
        targetOrgId,
        tx,
      );

      const nominationSource: ContractorWorkforceHistorySource =
        accessContext.supplierScopeId != null
          ? ContractorWorkforceHistorySource.SUPPLIER_PORTAL
          : ContractorWorkforceHistorySource.OPS;

      await this.workforceHistory.recordTransition({
        tx,
        contractorId: created.id,
        organizationId: targetOrgId,
        fromState: null,
        toState: initialWorkforceState,
        actorUserId: accessContext.actorUserId,
        reason: nominationReason ?? sponsorNote ?? null,
        source: nominationSource,
        effectiveAt: startDate,
        metadata: {
          supplierId: dto.supplierId,
          engagementId: createdEngagement.id,
          intake: true,
        },
      });

      return {
        contractor: await tx.contractor.findUniqueOrThrow({
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
        }),
        engagementId: createdEngagement.id,
      };
    });

    await this.auditService.logAction(
      accessContext.actorUserId,
      'CONTRACTOR_CREATED',
      'Contractor',
      contractor.contractor.id,
      null,
      contractor.contractor,
      { organizationId: targetOrgId },
    );

    await this.auditService.logAction(
      accessContext.actorUserId,
      'CONTRACTOR_CREATED_IN_CMS',
      'Contractor',
      contractor.contractor.id,
      null,
      null,
      {
        organizationId: targetOrgId,
        metadata: {
          workforceIntake: 'NOMINATED',
          missingResponsibleManagerAtCreation: !sponsor.responsibleManagerEmployeeId,
          workerClassification: contractor.contractor.workerClassification,
          engagementModel: contractor.contractor.engagementModel,
          sponsorNote: sponsorNote ?? null,
          nominationReason: nominationReason ?? null,
          engagementId: contractor.engagementId,
        },
      },
    );

    await this.workforceEventPublisher.publishNominationIntakeStub({
      contractorId: contractor.contractor.id,
      organizationId: targetOrgId,
      actorUserId: accessContext.actorUserId,
      reason: nominationReason,
      engagementId: contractor.engagementId,
      responsibleManagerEmployeeId: sponsor.responsibleManagerEmployeeId,
    });

    return contractor.contractor as any;
  }

  /**
   * ADR-013 Step 6 — enterprise independent acquisition at NOMINATED.
   * Not an extension of supplier nominate; no supplierId on the worker record.
   */
  async acquireIndependent(
    accessContext: AccessContext,
    dto: AcquireIndependentContractorDto,
  ): Promise<ContractorResponseDto> {
    const targetOrgId = accessContext.targetOrganizationId;
    if (!targetOrgId) throw new BadRequestException('Organization context is required');

    assertIndependentChannelNotSupplierScoped(accessContext.supplierScopeId);

    const existingContractor = await this.prisma.contractor.findFirst({
      where: {
        organizationId: targetOrgId,
        email: dto.email,
      },
    });

    if (existingContractor) {
      throw new ConflictException(
        'An external worker with this email already exists in your organization',
      );
    }

    if (dto.engagement.projectId) {
      const project = await this.prisma.project.findFirst({
        where: {
          id: dto.engagement.projectId,
          organizationId: targetOrgId,
        },
      });

      if (!project) {
        throw new NotFoundException('Project not found in your organization');
      }
    }

    const startDate = new Date(dto.engagement.startDate);
    const endDate = dto.engagement.endDate
      ? new Date(dto.engagement.endDate)
      : undefined;

    if (endDate && endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    const responsibleManagerEmployeeId = dto.engagement.responsibleManagerEmployeeId.trim();
    if (!responsibleManagerEmployeeId) {
      throw new BadRequestException(
        'Primary sponsor is required for independent worker acquisition',
      );
    }

    await this.hcmResponsibleManagerLookup.assertResponsibleManagerReferencesAllowed(targetOrgId, {
      responsibleManagerEmployeeId,
      responsibleManagerDelegateEmployeeId: dto.engagement.responsibleManagerDelegateEmployeeId ?? null,
    });

    const {
      sponsorNote,
      acquisitionReason,
      engagement,
      accessExpiresAt,
      dateOfBirth,
      skills,
      ...workerFields
    } = dto;
    const initialWorkforceState = ContractorWorkforceState.NOMINATED;

    const contractor = await this.prisma.$transaction(async (tx) => {
      const created = await tx.contractor.create({
        data: {
          ...workerFields,
          organizationId: targetOrgId,
          acquisitionModel: INDEPENDENT_CHANNEL_ACQUISITION_MODEL,
          workforceState: initialWorkforceState,
          isActive: deriveIsActiveFromWorkforceState(initialWorkforceState),
          skills: skills || [],
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
          accessExpiresAt: accessExpiresAt ? new Date(accessExpiresAt) : undefined,
        },
      });

      const createdEngagement = await tx.contractorEngagement.create({
        data: {
          contractorId: created.id,
          projectId: engagement.projectId,
          costCenterId: engagement.costCenterId,
          role: engagement.role,
          startDate,
          endDate,
          rateType: engagement.rateType,
          rateAmount: engagement.rateAmount,
          currency: engagement.currency || 'ZAR',
          isActive: true,
          responsibleManagerEmployeeId,
          responsibleManagerDelegateEmployeeId: engagement.responsibleManagerDelegateEmployeeId ?? null,
          responsibleManagerStatus: ResponsibleManagerAccountabilityStatus.RESPONSIBLE_MANAGER_ASSIGNED,
        },
      });

      await this.accessIntegrationPublish.publishExternalPersonCreated(
        toIgaEventContractorSlice(created),
        targetOrgId,
        tx,
      );

      await this.workforceHistory.recordTransition({
        tx,
        contractorId: created.id,
        organizationId: targetOrgId,
        fromState: null,
        toState: initialWorkforceState,
        actorUserId: accessContext.actorUserId,
        reason: acquisitionReason ?? sponsorNote ?? null,
        source: ContractorWorkforceHistorySource.OPS,
        effectiveAt: startDate,
        metadata: {
          acquisitionModel: INDEPENDENT_CHANNEL_ACQUISITION_MODEL,
          engagementId: createdEngagement.id,
          intake: true,
          channel: 'enterprise_independent_acquire',
        },
      });

      return {
        contractor: await tx.contractor.findUniqueOrThrow({
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
        }),
        engagementId: createdEngagement.id,
      };
    });

    await this.auditService.logAction(
      accessContext.actorUserId,
      'CONTRACTOR_CREATED',
      'Contractor',
      contractor.contractor.id,
      null,
      contractor.contractor,
      { organizationId: targetOrgId },
    );

    await this.auditService.logAction(
      accessContext.actorUserId,
      'CONTRACTOR_ACQUIRED_INDEPENDENT',
      'Contractor',
      contractor.contractor.id,
      null,
      null,
      {
        organizationId: targetOrgId,
        metadata: {
          acquisitionModel: INDEPENDENT_CHANNEL_ACQUISITION_MODEL,
          workforceIntake: 'NOMINATED',
          workerClassification: contractor.contractor.workerClassification,
          engagementModel: contractor.contractor.engagementModel,
          sponsorNote: sponsorNote ?? null,
          acquisitionReason: acquisitionReason ?? null,
          engagementId: contractor.engagementId,
        },
      },
    );

    await this.workforceEventPublisher.publishNominationIntakeStub({
      contractorId: contractor.contractor.id,
      organizationId: targetOrgId,
      actorUserId: accessContext.actorUserId,
      reason: acquisitionReason,
      engagementId: contractor.engagementId,
      responsibleManagerEmployeeId,
    });

    return contractor.contractor as any;
  }

  private formatSupplierDisplayName(
    supplier: {
      companyName?: string | null;
      tradingName?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      email: string;
    } | null,
  ): string {
    if (!supplier) {
      return 'Enterprise direct';
    }
    return (
      supplier.companyName?.trim() ||
      supplier.tradingName?.trim() ||
      [supplier.firstName, supplier.lastName].filter(Boolean).join(' ').trim() ||
      supplier.email
    );
  }

  private mapWorkforceReviewPlacementIntent(
    engagement: {
      id: string;
      role: string;
      startDate: Date;
      endDate: Date | null;
      rateType: string;
      rateAmount: { toString(): string };
      currency: string;
      responsibleManagerEmployeeId: string | null;
      contract: {
        id: string;
        contractNumber: string;
        title: string;
      } | null;
    } | undefined,
  ) {
    if (!engagement) {
      return null;
    }
    return {
      engagementId: engagement.id,
      role: engagement.role,
      startDate: engagement.startDate,
      endDate: engagement.endDate,
      rateType: engagement.rateType,
      rateAmount: engagement.rateAmount.toString(),
      currency: engagement.currency,
      responsibleManagerEmployeeId: engagement.responsibleManagerEmployeeId,
      ...(engagement.contract
        ? {
            contractId: engagement.contract.id,
            contractNumber: engagement.contract.contractNumber,
            contractTitle: engagement.contract.title,
          }
        : {}),
    };
  }

  private normalizeNominationResponsibleManager(engagement: NominateContractorDto['engagement']): {
    responsibleManagerEmployeeId: string | null;
    responsibleManagerDelegateEmployeeId: string | null;
    responsibleManagerStatus: ResponsibleManagerAccountabilityStatus | null;
  } {
    const trimId = (v: string | null | undefined): string | null => {
      if (v === undefined || v === null) return null;
      const t = String(v).trim();
      return t === '' ? null : t;
    };

    const responsibleManagerEmployeeId = trimId(engagement.responsibleManagerEmployeeId);
    const responsibleManagerDelegateEmployeeId = trimId(engagement.responsibleManagerDelegateEmployeeId);

    if (engagement.responsibleManagerStatus != null && responsibleManagerEmployeeId == null) {
      throw new BadRequestException(
        'responsibleManagerStatus requires responsibleManagerEmployeeId (primary sponsor accountability)',
      );
    }

    const responsibleManagerStatus =
      responsibleManagerEmployeeId != null
        ? engagement.responsibleManagerStatus ?? ResponsibleManagerAccountabilityStatus.RESPONSIBLE_MANAGER_ASSIGNED
        : null;

    return {
      responsibleManagerEmployeeId,
      responsibleManagerDelegateEmployeeId,
      responsibleManagerStatus,
    };
  }

  /**
   * PR-WORKFORCE-OPS-REVIEW-1 — internal queue for supplier-backed workforce intake.
   * Ops review advances workforce state; it is not an approval workflow engine.
   */
  async listWorkforceReviewQueue(
    accessContext: AccessContext,
    query: QueryContractorWorkforceReviewDto = {},
  ): Promise<ContractorWorkforceReviewQueueResponseDto> {
    const reviewStates =
      query.workforceState &&
      WORKFORCE_OPS_REVIEW_STATES.includes(query.workforceState)
        ? [query.workforceState]
        : [...WORKFORCE_OPS_REVIEW_STATES];

    const where: Record<string, unknown> = {};
    applyContractorOrganizationScope(where, accessContext);
    applyResponsibleManagerContractorScope(where, accessContext);

    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      excludeComparisonAnchorContractorsWhere(),
      { workforceState: { in: reviewStates } },
    ];

    const canUpdate = permissionSatisfied(
      accessContext.effectivePermissions,
      PERMISSIONS.CONTRACTORS.UPDATE,
    );

    const contractors = await this.prisma.contractor.findMany({
      where,
      orderBy: [{ workforceState: 'asc' }, { createdAt: 'asc' }],
      include: {
        supplier: {
          select: {
            id: true,
            type: true,
            companyName: true,
            tradingName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        engagements: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            contract: {
              select: {
                id: true,
                contractNumber: true,
                title: true,
              },
            },
          },
        },
      },
    });

    const data: ContractorWorkforceReviewQueueItemDto[] = contractors.map((row) => {
      const engagement = row.engagements[0];
      const nextTargetState = resolveOpsReviewNextTargetState(row.workforceState);
      const supplierDisplayName = this.formatSupplierDisplayName(row.supplier);

      return {
        id: row.id,
        supplierId: row.supplierId,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        workerClassification: row.workerClassification,
        engagementModel: row.engagementModel,
        workforceState: row.workforceState,
        isActive: row.isActive,
        createdAt: row.createdAt,
        supplierDisplayName,
        placementIntent: this.mapWorkforceReviewPlacementIntent(engagement),
        canSubmitForReview:
          canUpdate && row.workforceState === ContractorWorkforceState.NOMINATED,
        canActivate:
          canUpdate && row.workforceState === ContractorWorkforceState.PENDING_APPROVAL,
        canReject:
          canUpdate &&
          (row.workforceState === ContractorWorkforceState.NOMINATED ||
            row.workforceState === ContractorWorkforceState.PENDING_APPROVAL),
        canSendBack:
          canUpdate && row.workforceState === ContractorWorkforceState.PENDING_APPROVAL,
        canBlacklist: canUpdate && canTransitionToBlacklisted(row.workforceState),
        canReopen: false,
        nextTargetState,
      };
    });

    return { data, total: data.length };
  }

  async listWorkforceTimeline(
    accessContext: AccessContext,
    contractorId: string,
  ): Promise<ContractorWorkforceTimelineResponseDto> {
    const where: Record<string, unknown> = { id: contractorId };
    applyContractorOrganizationScope(where, accessContext);
    applyResponsibleManagerContractorScope(where, accessContext);

    const contractor = await this.prisma.contractor.findFirst({ where });
    if (!contractor) {
      throw new NotFoundException('Contractor not found');
    }

    const data = await this.workforceHistory.listForContractor(contractorId);
    return { data };
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

    const where: any = {};
    applyContractorOrganizationScope(where, accessContext);
    applyResponsibleManagerContractorScope(where, accessContext);

    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      excludeComparisonAnchorContractorsWhere(),
    ];

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
    applyContractorOrganizationScope(where, accessContext);
    applyResponsibleManagerContractorScope(where, accessContext);

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
    applyContractorOrganizationScope(where, accessContext);

    // Check if contractor exists and belongs to organization
    const existingContractor = await this.prisma.contractor.findFirst({
      where,
    });

    if (!existingContractor) {
      throw new NotFoundException('Contractor not found');
    }

    let outboxOrganizationId = accessContext.targetOrganizationId;
    if (!outboxOrganizationId) {
      outboxOrganizationId = existingContractor.organizationId;
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

      assertSupplierOperationalTrustGranted({
        status: newSupplier.status,
        supplierName: newSupplier.tradingName ?? newSupplier.companyName ?? undefined,
      });
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

    const { isActive, ...profilePatch } = updateContractorDto;

    const contractor = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.contractor.update({
        where: { id },
        data: {
          ...profilePatch,
          dateOfBirth: updateContractorDto.dateOfBirth
            ? new Date(updateContractorDto.dateOfBirth)
            : undefined,
          accessExpiresAt: updateContractorDto.accessExpiresAt
            ? new Date(updateContractorDto.accessExpiresAt)
            : undefined,
        },
      });

      if (isActive !== undefined) {
        await this.workforceStateService.applyLegacyIsActiveChange(
          accessContext,
          existingContractor,
          isActive,
          'legacy_patch_isActive',
          tx,
        );
      }

      const current = await tx.contractor.findUniqueOrThrow({ where: { id } });
      await this.accessIntegrationPublish.publishExternalPersonUpdated(
        toIgaEventContractorSlice(current),
        outboxOrganizationId,
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

  async transitionWorkforceState(
    accessContext: AccessContext,
    id: string,
    targetState: ContractorWorkforceState,
    reason?: string,
    authorityNote?: string,
  ): Promise<ContractorResponseDto> {
    const where: Record<string, unknown> = { id };
    applyContractorOrganizationScope(where, accessContext);

    const contractor = await this.prisma.contractor.findFirst({ where });
    if (!contractor) {
      throw new NotFoundException('Contractor not found');
    }

    await this.workforceStateService.applyTransition({
      accessContext,
      contractorId: id,
      targetState,
      reason,
      authorityNote,
      source: ContractorWorkforceHistorySource.OPS,
    });

    return this.findOne(accessContext, id);
  }

  /**
   * PR-WORKFORCE-REVIEW-OUTCOMES-1 — rejected nominations (reopen from registry, not review queue).
   */
  async listWorkforceRejected(
    accessContext: AccessContext,
  ): Promise<ContractorWorkforceReviewQueueResponseDto> {
    const where: Record<string, unknown> = {};
    applyContractorOrganizationScope(where, accessContext);
    applyResponsibleManagerContractorScope(where, accessContext);

    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      excludeComparisonAnchorContractorsWhere(),
      { workforceState: ContractorWorkforceState.REJECTED },
    ];

    const canUpdate = permissionSatisfied(
      accessContext.effectivePermissions,
      PERMISSIONS.CONTRACTORS.UPDATE,
    );

    const contractors = await this.prisma.contractor.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        supplier: {
          select: {
            id: true,
            type: true,
            companyName: true,
            tradingName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        engagements: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            contract: {
              select: {
                id: true,
                contractNumber: true,
                title: true,
              },
            },
          },
        },
      },
    });

    const data: ContractorWorkforceReviewQueueItemDto[] = contractors.map((row) => {
      const engagement = row.engagements[0];
      const supplierDisplayName = this.formatSupplierDisplayName(row.supplier);

      return {
        id: row.id,
        supplierId: row.supplierId,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        workerClassification: row.workerClassification,
        engagementModel: row.engagementModel,
        workforceState: row.workforceState,
        isActive: row.isActive,
        createdAt: row.createdAt,
        supplierDisplayName,
        placementIntent: this.mapWorkforceReviewPlacementIntent(engagement),
        canSubmitForReview: false,
        canActivate: false,
        canReject: false,
        canSendBack: false,
        canBlacklist: canUpdate && canTransitionToBlacklisted(row.workforceState),
        canReopen: canUpdate,
        nextTargetState: canUpdate ? ContractorWorkforceState.NOMINATED : null,
      };
    });

    return { data, total: data.length };
  }

  /** PR-WORKFORCE-BLACKLIST-1 — active/terminated contractors eligible for ops policy block. */
  async listWorkforceBlacklistEligible(
    accessContext: AccessContext,
  ): Promise<ContractorWorkforceReviewQueueResponseDto> {
    const where: Record<string, unknown> = {};
    applyContractorOrganizationScope(where, accessContext);
    applyResponsibleManagerContractorScope(where, accessContext);

    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      excludeComparisonAnchorContractorsWhere(),
      {
        workforceState: {
          in: [ContractorWorkforceState.ACTIVE, ContractorWorkforceState.TERMINATED],
        },
      },
    ];

    const canUpdate = permissionSatisfied(
      accessContext.effectivePermissions,
      PERMISSIONS.CONTRACTORS.UPDATE,
    );

    const contractors = await this.prisma.contractor.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        supplier: {
          select: {
            id: true,
            type: true,
            companyName: true,
            tradingName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        engagements: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            contract: {
              select: {
                id: true,
                contractNumber: true,
                title: true,
              },
            },
          },
        },
      },
    });

    const data: ContractorWorkforceReviewQueueItemDto[] = contractors.map((row) => {
      const engagement = row.engagements[0];
      const supplierDisplayName = this.formatSupplierDisplayName(row.supplier);

      return {
        id: row.id,
        supplierId: row.supplierId,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        workerClassification: row.workerClassification,
        engagementModel: row.engagementModel,
        workforceState: row.workforceState,
        isActive: row.isActive,
        createdAt: row.createdAt,
        supplierDisplayName,
        placementIntent: this.mapWorkforceReviewPlacementIntent(engagement),
        canSubmitForReview: false,
        canActivate: false,
        canReject: false,
        canSendBack: false,
        canBlacklist: canUpdate && canTransitionToBlacklisted(row.workforceState),
        canReopen: false,
        nextTargetState: null,
      };
    });

    return { data, total: data.length };
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

    await this.workforceStateService.applyTransition({
      accessContext,
      contractorId: id,
      targetState: ContractorWorkforceState.TERMINATED,
      reason: 'deactivate_endpoint',
    });

    return this.prisma.contractor.findUniqueOrThrow({
      where: { id },
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
