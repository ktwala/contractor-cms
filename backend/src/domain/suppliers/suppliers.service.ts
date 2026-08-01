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
import { QuerySupplierApprovalQueueDto } from './dto/query-supplier-approval-queue.dto';
import {
  applyGovernanceBucketPrismaWhere,
  buildOracleLinkedSupplierWhere,
  filterSuppliersByPendingEvidence,
  SupplierGovernanceBucket,
} from './supplier-governance-query.util';
import { SupplierType, SupplierStatus } from '@prisma/client';
import {
  PaginatedSupplierResponseDto,
  SupplierResponseDto,
} from './dto/supplier-response.dto';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import {
  applySupplierEntityScope,
  assertSupplierEntityAccess,
} from '../../core/auth/utils/supplier-scope.helper';
import { AuditService } from '../../core/audit/audit.service';
import { redactSupplierRecord } from '../../core/auth/utils/finance-visibility.helper';
import { SupplierLifecycleService } from './supplier-lifecycle.service';
import { SupplierStatusTransitionDto } from './dto/supplier-status-transition.dto';
import { SupplierEvidenceChecklistService } from './supplier-evidence-checklist.service';
import {
  isProcurementEvidenceTrusted,
  resolveSupplierEvidenceAuthorityMode,
} from './supplier-evidence-policy';
import { resolveSupplierApprovalWaitingReason } from './supplier-approval-queue.util';
import { isSupplierApprovalTransition } from './supplier-lifecycle.constants';
import { SupplierTransitionReasonRequiredException } from './supplier-lifecycle.errors';
import {
  SupplierApprovalQueueItemDto,
  SupplierApprovalQueueResponseDto,
  SupplierEvidenceSummaryStatus,
} from './dto/supplier-approval-queue.dto';
import {
  normalizeSupplierJurisdictionCode,
  resolveJurisdictionInput,
  resolveSupplierJurisdictionCode,
} from './supplier-jurisdiction.constants';
import { UnsupportedSupplierJurisdictionException } from './supplier-jurisdiction.errors';
import {
  excludeComparisonAnchorSuppliersWhere,
} from '../demo/connector-demo-comparison.constants';
import { TenantAuthorityService } from '../../core/authority/tenant-authority.service';
import { assertSupplierMasterCreationAllowed } from '../../core/authority/supplier-authority.helper';
import { assertOracleSourceIdentityNotMutated } from '../supplier-sources/supplier-source-identity.helper';

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly supplierLifecycle: SupplierLifecycleService,
    private readonly evidenceChecklist: SupplierEvidenceChecklistService,
    private readonly tenantAuthority: TenantAuthorityService,
  ) {}

  private resolveJurisdictionFields(dto: {
    country?: string;
    countryCode?: string;
  }) {
    if (dto.countryCode?.trim() && !normalizeSupplierJurisdictionCode(dto.countryCode)) {
      throw new UnsupportedSupplierJurisdictionException(dto.countryCode);
    }
    if (
      !dto.countryCode?.trim() &&
      dto.country?.trim() &&
      !normalizeSupplierJurisdictionCode(dto.country)
    ) {
      throw new UnsupportedSupplierJurisdictionException(dto.country);
    }
    return resolveJurisdictionInput(dto.country, dto.countryCode);
  }

  private presentSupplier(
    accessContext: AccessContext,
    supplier: unknown,
  ): SupplierResponseDto {
    return redactSupplierRecord(
      supplier as Record<string, unknown>,
      accessContext.effectivePermissions,
    ) as unknown as SupplierResponseDto;
  }

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

    const authority = await this.tenantAuthority.resolveForOrganization(targetOrgId);
    assertSupplierMasterCreationAllowed(accessContext, authority);

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

    const { country, countryCode } = this.resolveJurisdictionFields(createSupplierDto);

    const supplier = await this.prisma.supplier.create({
      data: {
        ...createSupplierDto,
        country,
        countryCode,
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

    return this.presentSupplier(accessContext, supplier);
  }

  async findAll(
    accessContext: AccessContext,
    query: QuerySupplierDto,
  ): Promise<PaginatedSupplierResponseDto> {
    const {
      search,
      type,
      status,
      country,
      governanceBucket,
      page = 1,
      limit = 20,
    } = query;

    const organizationId = accessContext.targetOrganizationId;
    if (governanceBucket && !organizationId) {
      throw new BadRequestException('Organization context is required');
    }

    let where: Record<string, unknown> = accessContext.isGlobalAccess
      ? {}
      : { organizationId };

    applySupplierEntityScope(where, accessContext);

    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      excludeComparisonAnchorSuppliersWhere(),
    ];

    if (governanceBucket && organizationId) {
      where = applyGovernanceBucketPrismaWhere(
        { ...where, ...buildOracleLinkedSupplierWhere(organizationId) },
        governanceBucket as SupplierGovernanceBucket,
      );
    }

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

    if (governanceBucket === 'pending_evidence' && organizationId) {
      const org = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { supplierAuthorityMode: true },
      });
      const pendingRows = await this.prisma.supplier.findMany({
        where,
        include: { documents: true },
        orderBy: { createdAt: 'desc' },
      });
      const filtered = filterSuppliersByPendingEvidence({
        suppliers: pendingRows,
        supplierAuthorityMode: org?.supplierAuthorityMode ?? 'CMS_ONLY',
        evidenceChecklist: this.evidenceChecklist,
      });
      const total = filtered.length;
      const pageRows = filtered.slice((page - 1) * limit, page * limit);
      return {
        data: pageRows.map((supplier) =>
          this.presentSupplier(accessContext, supplier),
        ),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 0,
      };
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
      data: suppliers.map((supplier) =>
        this.presentSupplier(accessContext, supplier),
      ),
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
    assertSupplierEntityAccess(accessContext, id);

    const where: any = { id };
    if (!accessContext.isGlobalAccess) {
      where.organizationId = accessContext.targetOrganizationId;
    }
    applySupplierEntityScope(where, accessContext);

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

    return this.presentSupplier(accessContext, supplier);
  }

  async update(
    accessContext: AccessContext,
    id: string,
    updateSupplierDto: UpdateSupplierDto,
  ): Promise<any> {
    assertSupplierEntityAccess(accessContext, id);

    const where: any = { id };
    if (!accessContext.isGlobalAccess) {
      where.organizationId = accessContext.targetOrganizationId;
    }
    applySupplierEntityScope(where, accessContext);

    // Check if supplier exists and belongs to organization
    const existingSupplier = await this.prisma.supplier.findFirst({
      where,
    });

    if (!existingSupplier) {
      throw new NotFoundException('Supplier not found');
    }

    assertOracleSourceIdentityNotMutated(
      existingSupplier,
      updateSupplierDto as Record<string, unknown>,
    );

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

    let jurisdictionFields: { country?: string; countryCode?: string } = {};
    if (
      updateSupplierDto.country !== undefined ||
      updateSupplierDto.countryCode !== undefined
    ) {
      jurisdictionFields = this.resolveJurisdictionFields({
        country: updateSupplierDto.country ?? existingSupplier.country,
        countryCode: updateSupplierDto.countryCode ?? existingSupplier.countryCode,
      });
    }

    const {
      sourceSystem: _sourceSystem,
      externalSupplierId: _externalSupplierId,
      organizationId: _organizationId,
      ...profilePatch
    } = updateSupplierDto;

    const supplier = await this.prisma.supplier.update({
      where: { id },
      data: {
        ...profilePatch,
        ...jurisdictionFields,
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

    return this.presentSupplier(accessContext, supplier);
  }

  async remove(accessContext: AccessContext, id: string): Promise<void> {
    assertSupplierEntityAccess(accessContext, id);

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

  private resolveEvidenceSummaryStatus(checklist: {
    complete: boolean;
    expiredCount: number;
  }): SupplierEvidenceSummaryStatus {
    if (checklist.complete) return 'COMPLETE';
    if (checklist.expiredCount > 0) return 'EXPIRED';
    return 'INCOMPLETE';
  }

  async listApprovalQueue(
    accessContext: AccessContext,
    query: QuerySupplierApprovalQueueDto = {},
  ): Promise<SupplierApprovalQueueResponseDto> {
    const where: Record<string, unknown> = {
      status: SupplierStatus.PENDING_APPROVAL,
    };

    const organizationId = accessContext.targetOrganizationId;
    if (!accessContext.isGlobalAccess) {
      where.organizationId = organizationId;
    }

    applySupplierEntityScope(where, accessContext);

    const org = organizationId
      ? await this.prisma.organization.findUnique({
          where: { id: organizationId },
          select: { supplierAuthorityMode: true },
        })
      : null;
    const supplierAuthorityMode = org?.supplierAuthorityMode ?? 'CMS_ONLY';
    const evidenceAuthorityMode = resolveSupplierEvidenceAuthorityMode(supplierAuthorityMode);

    const suppliers = await this.prisma.supplier.findMany({
      where,
      include: { documents: true },
      orderBy: { createdAt: 'asc' },
    });

    const data: SupplierApprovalQueueItemDto[] = suppliers
      .map((supplier) => {
      const jurisdictionCode = resolveSupplierJurisdictionCode(
        supplier.country,
        supplier.countryCode,
      );
      const checklist = this.evidenceChecklist.evaluateChecklist(
        supplier.id,
        supplier.type,
        jurisdictionCode,
        supplier.documents,
      );
      const presented = this.presentSupplier(
        accessContext,
        supplier,
      ) as unknown as SupplierApprovalQueueItemDto;

      const selfScoped =
        accessContext.supplierScopeId != null &&
        accessContext.supplierScopeId === supplier.id;

      const procurementEvidenceTrusted = isProcurementEvidenceTrusted({
        evidenceAuthorityMode,
        sourceSystem: supplier.sourceSystem,
        externalSupplierId: supplier.externalSupplierId,
        sourceSyncStatus: supplier.sourceSyncStatus,
      });
      const evidenceComplete = this.evidenceChecklist.isApprovalEvidenceSatisfied({
        supplierAuthorityMode,
        sourceSystem: supplier.sourceSystem,
        externalSupplierId: supplier.externalSupplierId,
        sourceSyncStatus: supplier.sourceSyncStatus,
        checklist,
      });

      presented.evidenceStatus = procurementEvidenceTrusted
        ? 'COMPLETE'
        : this.resolveEvidenceSummaryStatus(checklist);
      presented.evidenceComplete = evidenceComplete;
      presented.evidenceNote = procurementEvidenceTrusted
        ? 'Inherited from Oracle Supplier Portal'
        : undefined;
      presented.missingCount = checklist.missingCount;
      presented.expiredCount = checklist.expiredCount;
      presented.canApprove = !selfScoped;
      presented.jurisdictionCode = jurisdictionCode;
      presented.waitingFor = resolveSupplierApprovalWaitingReason({
        type: supplier.type,
        externalSupplierId: supplier.externalSupplierId,
      });

      return presented;
    })
      .filter((item) => {
        if (!query.evidenceIncomplete) return true;
        return !item.evidenceComplete;
      });

    return { data, total: data.length };
  }

  async transitionStatus(
    accessContext: AccessContext,
    id: string,
    dto: SupplierStatusTransitionDto,
  ): Promise<SupplierResponseDto> {
    assertSupplierEntityAccess(accessContext, id);

    const where: Record<string, unknown> = { id };
    if (!accessContext.isGlobalAccess) {
      where.organizationId = accessContext.targetOrganizationId;
    }

    const existing = await this.prisma.supplier.findFirst({ where });

    if (!existing) {
      throw new NotFoundException('Supplier not found');
    }

    const targetStatus = dto.targetStatus;

    this.supplierLifecycle.assertTransitionAllowed(
      existing.status,
      targetStatus,
    );
    this.supplierLifecycle.assertActorMayTransition(
      accessContext,
      existing.status,
      targetStatus,
      id,
    );

    if (
      existing.status === SupplierStatus.PENDING_APPROVAL &&
      targetStatus === SupplierStatus.SUSPENDED &&
      !dto.reason?.trim()
    ) {
      throw new SupplierTransitionReasonRequiredException();
    }

    if (
      targetStatus === SupplierStatus.ACTIVE &&
      isSupplierApprovalTransition(existing.status, targetStatus)
    ) {
      const jurisdictionCode = resolveSupplierJurisdictionCode(
        existing.country,
        existing.countryCode,
      );
      const org = await this.prisma.organization.findUnique({
        where: { id: existing.organizationId },
        select: { supplierAuthorityMode: true },
      });
      await this.evidenceChecklist.assertApprovalEvidenceComplete(
        id,
        existing.type,
        jurisdictionCode,
        org?.supplierAuthorityMode ?? 'CMS_ONLY',
        {
          sourceSystem: existing.sourceSystem,
          externalSupplierId: existing.externalSupplierId,
          sourceSyncStatus: existing.sourceSyncStatus,
        },
      );
    }

    const updated = await this.prisma.supplier.update({
      where: { id },
      data: { status: targetStatus },
    });

    const auditMeta = {
      organizationId: existing.organizationId,
      reason: dto.reason ?? null,
      fromStatus: existing.status,
      toStatus: targetStatus,
    };

    const actions = this.supplierLifecycle.resolveAuditActions(
      existing.status,
      targetStatus,
    );

    for (const action of actions) {
      await this.auditService.logAction(
        accessContext.actorUserId,
        action,
        'Supplier',
        id,
        { status: existing.status },
        { status: targetStatus },
        {
          organizationId: existing.organizationId,
          metadata: auditMeta,
        },
      );
    }

    return this.presentSupplier(accessContext, updated);
  }

  /**
   * Bind a supplier-portal user to a governed supplier (PR-SUPPLIER-SCOPING-1).
   * Synchronization and promotion do not create membership — ops assigns explicitly.
   */
  async assignPortalMembership(
    accessContext: AccessContext,
    supplierId: string,
    input: { userEmail: string; role?: 'ADMIN' | 'MANAGER' },
  ) {
    assertSupplierEntityAccess(accessContext, supplierId);

    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: supplierId,
        organizationId: accessContext.targetOrganizationId ?? undefined,
      },
    });
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        email: input.userEmail.trim(),
        organizationId: supplier.organizationId,
        isActive: true,
      },
    });
    if (!user) {
      throw new NotFoundException(
        `No active user found with email ${input.userEmail} in this organization`,
      );
    }

    const role = input.role ?? 'ADMIN';
    const membership = await this.prisma.supplierMembership.upsert({
      where: {
        userId_supplierId: { userId: user.id, supplierId: supplier.id },
      },
      create: {
        userId: user.id,
        supplierId: supplier.id,
        role,
        assignedBy: accessContext.actorUserId,
      },
      update: {
        role,
        isActive: true,
      },
    });

    await this.auditService.logAction(
      accessContext.actorUserId,
      'SUPPLIER_UPDATED',
      'Supplier',
      supplier.id,
      null,
      { portalMembershipUserId: user.id, portalMembershipRole: membership.role },
      {
        organizationId: supplier.organizationId,
        metadata: { userEmail: user.email },
      },
    );

    return {
      supplierId: supplier.id,
      userId: user.id,
      userEmail: user.email,
      role: membership.role,
    };
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
