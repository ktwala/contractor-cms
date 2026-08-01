import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupplierStatus, ContractorWorkforceState } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { AuditService } from '../../core/audit/audit.service';
import { redactSupplierRecord } from '../../core/auth/utils/finance-visibility.helper';
import { toIgaEventContractorSlice } from '../../core/iga/iga-event.mapper';
import { IgaWorkforceEventWriter } from '../../core/iga/iga-workforce-event-writer.service';
import { PdpOperationalGuardService } from '../../pdp/pdp-operational-guard.service';
import { SupplierPortalUpdateProfileDto } from './dto/supplier-portal-update-profile.dto';
import { SupplierPortalCreateContractorDto } from './dto/supplier-portal-create-contractor.dto';
import { QueryTimesheetDto } from '../timesheets/dto/query-timesheet.dto';
import { QuerySupplierPortalInvoicesDto } from './dto/query-supplier-portal-invoices.dto';
import { redactInvoiceRecord } from '../../core/auth/utils/finance-visibility.helper';
import { CreateSupplierDocumentDto } from '../suppliers/dto/create-supplier-document.dto';
import { SupplierDocumentsService } from '../suppliers/supplier-documents.service';
import { SupplierEvidenceChecklistService } from '../suppliers/supplier-evidence-checklist.service';
import { SupplierOnboardingEvidenceIncompleteException } from '../suppliers/supplier-evidence.errors';
import { SupplierLifecycleService } from '../suppliers/supplier-lifecycle.service';
import { auditActionForTransition } from '../suppliers/supplier-lifecycle.constants';
import { supplierMembershipRequiredException } from './supplier-portal.errors';
import {
  SUPPLIER_PORTAL_EMPTY_STATES,
  SupplierPortalDashboardData,
  SupplierPortalEnvelope,
} from './supplier-portal.types';
import { wrapSupplierPortalResponse } from './supplier-portal-response.util';
import { EvidenceChecklistResult } from '../suppliers/supplier-evidence.types';
import { ContractorsService } from '../contractors/contractors.service';
import { ContractorWorkforceHistoryService } from '../contractors/contractor-workforce-history.service';
import { presentSupplierPortalWorkforceTimeline } from './supplier-portal-workforce-timeline.util';

const supplierPortalContractorWhere = (supplierId: string) => ({
  supplierId,
  workforceState: { not: ContractorWorkforceState.BLACKLISTED },
});

const contractorListSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  workerClassification: true,
  engagementModel: true,
  workforceState: true,
  isActive: true,
  createdAt: true,
} as const;

const contractorDetailSelect = {
  ...contractorListSelect,
  taxResidency: true,
  engagements: {
    where: { isActive: true },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: {
      id: true,
      role: true,
      startDate: true,
      endDate: true,
      rateType: true,
      rateAmount: true,
      currency: true,
      responsibleManagerEmployeeId: true,
      contract: {
        select: {
          id: true,
          contractNumber: true,
          title: true,
        },
      },
    },
  },
} as const;

export type SupplierPortalOnboardingSummary = {
  jurisdictionCode: string;
  evidenceComplete: boolean;
  missingCount: number;
  expiredCount: number;
  canSubmit: boolean;
  inApprovalQueue: boolean;
};

export type SupplierPortalSubmitResult = {
  status: SupplierStatus;
  submitted: boolean;
  inApprovalQueue: boolean;
  message: string;
};

@Injectable()
export class SupplierPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly igaWorkforceEventWriter: IgaWorkforceEventWriter,
    private readonly evidenceChecklist: SupplierEvidenceChecklistService,
    private readonly supplierDocuments: SupplierDocumentsService,
    private readonly supplierLifecycle: SupplierLifecycleService,
    private readonly pdpGuard: PdpOperationalGuardService,
    private readonly contractorsService: ContractorsService,
    private readonly workforceHistory: ContractorWorkforceHistoryService,
  ) {}

  private permissionSet(accessContext: AccessContext): ReadonlySet<string> {
    return new Set(accessContext.effectivePermissions ?? []);
  }

  private buildOnboardingSummary(
    status: SupplierStatus,
    checklist: EvidenceChecklistResult,
  ): SupplierPortalOnboardingSummary {
    const submittableStatuses: SupplierStatus[] = [
      SupplierStatus.DRAFT,
      SupplierStatus.PENDING_APPROVAL,
    ];
    const canSubmit =
      submittableStatuses.includes(status) && checklist.complete;

    return {
      jurisdictionCode: checklist.jurisdictionCode,
      evidenceComplete: checklist.complete,
      missingCount: checklist.missingCount,
      expiredCount: checklist.expiredCount,
      canSubmit,
      inApprovalQueue: status === SupplierStatus.PENDING_APPROVAL,
    };
  }

  private requireSupplierScope(accessContext: AccessContext): string {
    if (!accessContext.supplierScopeId) {
      throw supplierMembershipRequiredException();
    }
    return accessContext.supplierScopeId;
  }

  private orgWhere(accessContext: AccessContext) {
    const organizationId =
      accessContext.targetOrganizationId ?? accessContext.actorOrganizationId;
    return organizationId ? { organizationId } : {};
  }

  async getProfile(
    accessContext: AccessContext,
  ): Promise<SupplierPortalEnvelope<Record<string, unknown> | null>> {
    const supplierId = this.requireSupplierScope(accessContext);

    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, ...this.orgWhere(accessContext) },
      include: { documents: true },
    });

    if (!supplier) {
      return wrapSupplierPortalResponse(accessContext, supplierId, null, {
        empty_state: SUPPLIER_PORTAL_EMPTY_STATES.NO_PROFILE,
      });
    }

    const checklist = await this.evidenceChecklist.buildChecklistForSupplier(
      supplierId,
    );
    const onboarding = this.buildOnboardingSummary(supplier.status, checklist);
    const redacted = redactSupplierRecord(
      supplier as unknown as Record<string, unknown>,
      this.permissionSet(accessContext),
    );

    return wrapSupplierPortalResponse(accessContext, supplierId, {
      ...redacted,
      onboarding,
      evidenceChecklist: checklist,
    });
  }

  async getEvidenceChecklist(
    accessContext: AccessContext,
  ): Promise<SupplierPortalEnvelope<EvidenceChecklistResult>> {
    const supplierId = this.requireSupplierScope(accessContext);
    const checklist = await this.supplierDocuments.getChecklist(
      accessContext,
      supplierId,
    );
    return wrapSupplierPortalResponse(accessContext, supplierId, checklist);
  }

  async listDocuments(accessContext: AccessContext) {
    const supplierId = this.requireSupplierScope(accessContext);
    const documents = await this.supplierDocuments.listDocuments(
      accessContext,
      supplierId,
    );
    return wrapSupplierPortalResponse(accessContext, supplierId, documents);
  }

  async createDocument(
    accessContext: AccessContext,
    dto: CreateSupplierDocumentDto,
  ) {
    const supplierId = this.requireSupplierScope(accessContext);
    const document = await this.supplierDocuments.createDocument(
      accessContext,
      supplierId,
      dto,
    );
    return wrapSupplierPortalResponse(accessContext, supplierId, document);
  }

  async submitForApproval(
    accessContext: AccessContext,
  ): Promise<SupplierPortalEnvelope<SupplierPortalSubmitResult>> {
    const supplierId = this.requireSupplierScope(accessContext);
    const targetOrgId = accessContext.targetOrganizationId;
    if (!targetOrgId) {
      throw new BadRequestException('Organization context is required');
    }

    const existing = await this.prisma.supplier.findFirst({
      where: { id: supplierId, organizationId: targetOrgId },
    });
    if (!existing) {
      throw new NotFoundException('Supplier profile not found');
    }

    const checklist = await this.evidenceChecklist.buildChecklistForSupplier(
      supplierId,
    );
    if (!checklist.complete) {
      throw new SupplierOnboardingEvidenceIncompleteException(checklist);
    }

    if (existing.status === SupplierStatus.ACTIVE) {
      const result: SupplierPortalSubmitResult = {
        status: SupplierStatus.ACTIVE,
        submitted: false,
        inApprovalQueue: false,
        message: 'Supplier is already active.',
      };
      return wrapSupplierPortalResponse(accessContext, supplierId, result);
    }

    if (existing.status === SupplierStatus.PENDING_APPROVAL) {
      const result: SupplierPortalSubmitResult = {
        status: SupplierStatus.PENDING_APPROVAL,
        submitted: true,
        inApprovalQueue: true,
        message:
          'Evidence is complete. Your supplier is in the operations approval queue.',
      };
      return wrapSupplierPortalResponse(accessContext, supplierId, result);
    }

    if (existing.status !== SupplierStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot submit for approval from status ${existing.status}`,
      );
    }

    this.supplierLifecycle.assertTransitionAllowed(
      existing.status,
      SupplierStatus.PENDING_APPROVAL,
    );

    const updated = await this.prisma.supplier.update({
      where: { id: supplierId },
      data: { status: SupplierStatus.PENDING_APPROVAL },
    });

    const auditMeta = {
      organizationId: existing.organizationId,
      fromStatus: existing.status,
      toStatus: SupplierStatus.PENDING_APPROVAL,
    };

    for (const action of auditActionForTransition(
      existing.status,
      SupplierStatus.PENDING_APPROVAL,
    )) {
      await this.auditService.logAction(
        accessContext.actorUserId,
        action,
        'Supplier',
        supplierId,
        { status: existing.status },
        { status: updated.status },
        auditMeta,
      );
    }

    const result: SupplierPortalSubmitResult = {
      status: SupplierStatus.PENDING_APPROVAL,
      submitted: true,
      inApprovalQueue: true,
      message:
        'Submitted for approval. Operations will review your supplier record.',
    };
    return wrapSupplierPortalResponse(accessContext, supplierId, result);
  }

  async updateProfile(
    accessContext: AccessContext,
    dto: SupplierPortalUpdateProfileDto,
  ) {
    const supplierId = this.requireSupplierScope(accessContext);

    const existing = await this.prisma.supplier.findFirst({
      where: { id: supplierId, ...this.orgWhere(accessContext) },
    });
    if (!existing) {
      throw new NotFoundException('Supplier profile not found');
    }

    return this.prisma.supplier.update({
      where: { id: supplierId },
      data: dto,
    });
  }

  async listContractors(accessContext: AccessContext, page = 1, limit = 20) {
    const supplierId = this.requireSupplierScope(accessContext);
    const where = supplierPortalContractorWhere(supplierId);

    const [data, total] = await Promise.all([
      this.prisma.contractor.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: contractorListSelect,
      }),
      this.prisma.contractor.count({ where }),
    ]);

    const pagination = {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    };

    return wrapSupplierPortalResponse(accessContext, supplierId, data, {
      pagination,
      empty_state:
        total === 0 ? SUPPLIER_PORTAL_EMPTY_STATES.NO_CONTRACTORS : null,
    });
  }

  async getContractor(accessContext: AccessContext, contractorId: string) {
    const supplierId = this.requireSupplierScope(accessContext);

    const contractor = await this.prisma.contractor.findFirst({
      where: {
        id: contractorId,
        ...supplierPortalContractorWhere(supplierId),
      },
      select: contractorDetailSelect,
    });

    if (!contractor) {
      throw new NotFoundException('Contractor not found for your supplier');
    }

    return wrapSupplierPortalResponse(accessContext, supplierId, contractor);
  }

  async getContractorWorkforceHistory(
    accessContext: AccessContext,
    contractorId: string,
  ) {
    const supplierId = this.requireSupplierScope(accessContext);

    const contractor = await this.prisma.contractor.findFirst({
      where: {
        id: contractorId,
        ...supplierPortalContractorWhere(supplierId),
      },
      select: { id: true },
    });

    if (!contractor) {
      throw new NotFoundException('Contractor not found for your supplier');
    }

    const entries = await this.workforceHistory.listForContractor(contractorId);
    const data = presentSupplierPortalWorkforceTimeline(entries);

    return wrapSupplierPortalResponse(accessContext, supplierId, data);
  }

  async listContracts(accessContext: AccessContext) {
    const supplierId = this.requireSupplierScope(accessContext);

    const contracts = await this.prisma.supplierContract.findMany({
      where: {
        supplierId,
        status: 'ACTIVE',
        ...this.orgWhere(accessContext),
      },
      orderBy: { startDate: 'desc' },
      select: {
        id: true,
        contractNumber: true,
        title: true,
        startDate: true,
        endDate: true,
        currency: true,
      },
    });

    return wrapSupplierPortalResponse(accessContext, supplierId, contracts);
  }

  async createContractor(
    accessContext: AccessContext,
    dto: SupplierPortalCreateContractorDto,
  ) {
    const supplierId = this.requireSupplierScope(accessContext);
    const targetOrgId = accessContext.targetOrganizationId;
    if (!targetOrgId) {
      throw new BadRequestException('Organization context is required');
    }

    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, organizationId: targetOrgId },
    });
    if (!supplier) {
      throw new NotFoundException('Supplier profile not found');
    }

    await this.pdpGuard.assertAllowed('CREATE_CONTRACTOR', {
      supplierId,
      organizationId: targetOrgId,
      transactionDate: new Date(),
    });

    const result = await this.contractorsService.nominate(accessContext, {
      supplierId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone,
      workerClassification: dto.workerClassification,
      engagementModel: dto.engagementModel,
      taxResidency: dto.taxResidency,
      nominationReason: dto.nominationReason,
      engagement: dto.engagement,
    });

    return result;
  }

  private presentPortalInvoice(
    accessContext: AccessContext,
    row: Record<string, unknown>,
  ): Record<string, unknown> {
    const base = {
      ...row,
      subtotal: row.subtotal != null ? String(row.subtotal) : null,
      vatAmount: row.vatAmount != null ? String(row.vatAmount) : null,
      totalAmount: row.totalAmount != null ? String(row.totalAmount) : null,
    };
    return redactInvoiceRecord(base, this.permissionSet(accessContext));
  }

  async listInvoices(
    accessContext: AccessContext,
    query: QuerySupplierPortalInvoicesDto,
  ) {
    const supplierId = this.requireSupplierScope(accessContext);
    const { status, page = 1, limit = 20 } = query;

    const where: Record<string, unknown> = {
      supplierId,
      ...this.orgWhere(accessContext),
    };
    if (status) {
      where.status = status;
    }

    const [rows, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { invoiceDate: 'desc' },
        select: {
          id: true,
          invoiceNumber: true,
          invoiceDate: true,
          dueDate: true,
          periodStart: true,
          periodEnd: true,
          status: true,
          currency: true,
          subtotal: true,
          vatAmount: true,
          totalAmount: true,
          submittedAt: true,
          approvedAt: true,
          paidAt: true,
          paymentReference: true,
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    const data = rows.map((row) =>
      this.presentPortalInvoice(
        accessContext,
        row as unknown as Record<string, unknown>,
      ),
    );

    return wrapSupplierPortalResponse(accessContext, supplierId, data, {
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 0,
      },
      empty_state: total === 0 ? SUPPLIER_PORTAL_EMPTY_STATES.NO_INVOICES : null,
    });
  }

  async listTimesheets(
    accessContext: AccessContext,
    query: QueryTimesheetDto,
  ) {
    const supplierId = this.requireSupplierScope(accessContext);
    const {
      contractorId,
      status,
      page = 1,
      limit = 20,
    } = query;

    const where: Record<string, unknown> = {
      contractor: { supplierId },
    };

    if (contractorId) {
      where.contractorId = contractorId;
    }
    if (status) {
      where.status = status;
    }

    const [data, total] = await Promise.all([
      this.prisma.timesheet.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          contractor: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
      this.prisma.timesheet.count({ where }),
    ]);

    const pagination = {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    };

    return wrapSupplierPortalResponse(accessContext, supplierId, data, {
      pagination,
      empty_state:
        total === 0 ? SUPPLIER_PORTAL_EMPTY_STATES.NO_TIMESHEETS : null,
    });
  }

  async getDashboard(
    accessContext: AccessContext,
  ): Promise<SupplierPortalEnvelope<SupplierPortalDashboardData>> {
    const supplierId = this.requireSupplierScope(accessContext);

    const [supplier, checklist, contractorCount, timesheetRows] = await Promise.all([
      this.prisma.supplier.findFirst({
        where: { id: supplierId, ...this.orgWhere(accessContext) },
        select: {
          companyName: true,
          tradingName: true,
          firstName: true,
          lastName: true,
          status: true,
          country: true,
          countryCode: true,
        },
      }),
      this.evidenceChecklist.buildChecklistForSupplier(supplierId),
      this.prisma.contractor.count({
        where: supplierPortalContractorWhere(supplierId),
      }),
      this.prisma.timesheet.findMany({
        where: { contractor: { supplierId } },
        select: { status: true },
      }),
    ]);

    const displayName =
      supplier?.companyName?.trim() ||
      supplier?.tradingName?.trim() ||
      [supplier?.firstName, supplier?.lastName].filter(Boolean).join(' ').trim() ||
      null;

    const timesheets = {
      total: timesheetRows.length,
      pending: timesheetRows.filter((t) => t.status === 'SUBMITTED').length,
      approved: timesheetRows.filter((t) => t.status === 'APPROVED').length,
      rejected: timesheetRows.filter((t) => t.status === 'REJECTED').length,
      draft: timesheetRows.filter((t) => t.status === 'DRAFT').length,
    };

    const onboarding = supplier
      ? this.buildOnboardingSummary(supplier.status, checklist)
      : null;

    const data: SupplierPortalDashboardData = {
      profile: {
        available: Boolean(supplier),
        display_name: displayName,
        status: supplier?.status ?? null,
        country: supplier?.country ?? null,
        countryCode: supplier?.countryCode ?? null,
      },
      onboarding,
      contractors: { count: contractorCount },
      timesheets,
    };

    return wrapSupplierPortalResponse(accessContext, supplierId, data);
  }
}
