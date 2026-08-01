import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContractorGovernanceRemediationStatus,
  ContractorSourceDriftSeverity,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { AuditService } from '../../core/audit/audit.service';
import { GOVERNANCE_REMEDIATION_DUE_HOURS_CRITICAL } from './contractor-governance-remediation.constants';
import { WORKFORCE_TELEMETRY_POPULATION_SCOPES } from '../contractor-sources/workforce-telemetry-population.constants';
import {
  formatDriftTypeLabel,
  formatRemediationTypeLabel,
} from './contractor-governance-remediation.labels';
import {
  POLICY_DECISION_RESTRICTED,
  buildPolicyEvaluationSteps,
  resolvePolicyEvaluationContext,
} from '../../pdp/policy-evaluation-context.util';
import { ContractorGovernanceRemediationOrchestratorService } from './contractor-governance-remediation-orchestrator.service';
import {
  CloseContractorGovernanceRemediationDto,
  ContractorGovernanceRemediationItemDto,
  ContractorGovernanceRemediationSummaryDto,
  CreateContractorGovernanceRemediationDto,
  PaginatedContractorGovernanceRemediationDto,
} from './dto/contractor-governance-remediation.dto';

const ACTIVE_REMEDIATION_STATUSES: ContractorGovernanceRemediationStatus[] = [
  ContractorGovernanceRemediationStatus.OPEN,
  ContractorGovernanceRemediationStatus.ACKNOWLEDGED,
  ContractorGovernanceRemediationStatus.REMEDIATION_IN_PROGRESS,
  ContractorGovernanceRemediationStatus.VERIFIED,
];

@Injectable()
export class ContractorGovernanceRemediationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orchestrator: ContractorGovernanceRemediationOrchestratorService,
    private readonly auditService: AuditService,
  ) {}

  private resolveOrgId(accessContext: AccessContext): string {
    const orgId = accessContext.targetOrganizationId;
    if (!orgId) {
      throw new BadRequestException('Organization context is required');
    }
    return orgId;
  }

  async create(
    accessContext: AccessContext,
    dto: CreateContractorGovernanceRemediationDto,
  ): Promise<ContractorGovernanceRemediationItemDto> {
    const organizationId = this.resolveOrgId(accessContext);
    const remediation = await this.orchestrator.createRemediationForDrift(
      organizationId,
      dto.driftId,
      accessContext.actorUserId,
      dto.remediationType,
    );
    if (!remediation) {
      throw new NotFoundException('Drift record not found');
    }

    if (dto.assignedToUserId) {
      const assigned = await this.prisma.contractorGovernanceRemediation.update({
        where: { id: remediation.id },
        data: { assignedToUserId: dto.assignedToUserId },
        include: { drift: true },
      });
      return this.toDto(assigned);
    }

    return this.toDto(
      await this.prisma.contractorGovernanceRemediation.findUniqueOrThrow({
        where: { id: remediation.id },
        include: { drift: true },
      }),
    );
  }

  async list(
    accessContext: AccessContext,
    query: { status?: ContractorGovernanceRemediationStatus; page?: number; limit?: number },
  ): Promise<PaginatedContractorGovernanceRemediationDto> {
    const organizationId = this.resolveOrgId(accessContext);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ContractorGovernanceRemediationWhereInput = {
      organizationId,
      ...(query.status ? { remediationStatus: query.status } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.contractorGovernanceRemediation.findMany({
        where,
        include: { drift: true },
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.contractorGovernanceRemediation.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toDto(row)),
      total,
      page,
      limit,
    };
  }

  async getSummary(
    accessContext: AccessContext,
  ): Promise<ContractorGovernanceRemediationSummaryDto> {
    const organizationId = this.resolveOrgId(accessContext);
    const openWhere = {
      organizationId,
      remediationStatus: { in: ACTIVE_REMEDIATION_STATUSES },
    };
    const overdueBefore = new Date(
      Date.now() - GOVERNANCE_REMEDIATION_DUE_HOURS_CRITICAL * 60 * 60 * 1000,
    );

    const [
      activeRemediations,
      criticalUnresolved,
      pdpRestrictionsActive,
      escalationsOverdue,
      missingResponsibleManagerGovernanceOpen,
    ] = await Promise.all([
      this.prisma.contractorGovernanceRemediation.count({ where: openWhere }),
      this.prisma.contractorGovernanceRemediation.count({
        where: {
          ...openWhere,
          drift: { severity: ContractorSourceDriftSeverity.CRITICAL },
        },
      }),
      this.prisma.contractorGovernanceRemediation.count({
        where: { ...openWhere, pdpRestrictionsApplied: true },
      }),
      this.prisma.contractorGovernanceRemediation.count({
        where: {
          ...openWhere,
          dueAt: { lt: new Date() },
        },
      }),
      this.prisma.contractorGovernanceRemediation.count({
        where: {
          ...openWhere,
          drift: { driftType: 'MISSING_RESPONSIBLE_MANAGER' },
        },
      }),
    ]);

    return {
      organizationId,
      populationScope: WORKFORCE_TELEMETRY_POPULATION_SCOPES.workforceResolutionTasks,
      activeRemediations,
      criticalUnresolved,
      pdpRestrictionsActive,
      escalationsOverdue,
      missingResponsibleManagerGovernanceOpen,
      evaluatedAt: new Date().toISOString(),
    };
  }

  async acknowledge(
    accessContext: AccessContext,
    remediationId: string,
    assignedToUserId?: string,
  ): Promise<ContractorGovernanceRemediationItemDto> {
    const organizationId = this.resolveOrgId(accessContext);
    const existing = await this.loadRemediation(remediationId, organizationId);

    if (existing.remediationStatus === ContractorGovernanceRemediationStatus.CLOSED) {
      throw new BadRequestException('Remediation is already closed');
    }

    const now = new Date();
    const updated = await this.prisma.contractorGovernanceRemediation.update({
      where: { id: remediationId },
      data: {
        remediationStatus: ContractorGovernanceRemediationStatus.ACKNOWLEDGED,
        assignedToUserId: assignedToUserId ?? existing.assignedToUserId,
        auditTrail: this.orchestrator.appendAuditTrail(existing.auditTrail, {
          at: now.toISOString(),
          action: 'ACKNOWLEDGED',
          actorUserId: accessContext.actorUserId,
        }),
      },
      include: { drift: true },
    });

    await this.auditService.logAction(
      accessContext.actorUserId,
      'CONTRACTOR_GOVERNANCE_REMEDIATION_ACKNOWLEDGED',
      'ContractorGovernanceRemediation',
      remediationId,
      { status: existing.remediationStatus },
      { status: updated.remediationStatus },
      { organizationId },
    );

    return this.toDto(updated);
  }

  async startProgress(
    accessContext: AccessContext,
    remediationId: string,
  ): Promise<ContractorGovernanceRemediationItemDto> {
    const organizationId = this.resolveOrgId(accessContext);
    const existing = await this.loadRemediation(remediationId, organizationId);

    const updated = await this.prisma.contractorGovernanceRemediation.update({
      where: { id: remediationId },
      data: {
        remediationStatus: ContractorGovernanceRemediationStatus.REMEDIATION_IN_PROGRESS,
        auditTrail: this.orchestrator.appendAuditTrail(existing.auditTrail, {
          at: new Date().toISOString(),
          action: 'REMEDIATION_IN_PROGRESS',
          actorUserId: accessContext.actorUserId,
        }),
      },
      include: { drift: true },
    });

    return this.toDto(updated);
  }

  async verify(
    accessContext: AccessContext,
    remediationId: string,
    notes?: string,
  ): Promise<ContractorGovernanceRemediationItemDto> {
    const organizationId = this.resolveOrgId(accessContext);
    const existing = await this.loadRemediation(remediationId, organizationId);
    const now = new Date();

    const updated = await this.prisma.contractorGovernanceRemediation.update({
      where: { id: remediationId },
      data: {
        remediationStatus: ContractorGovernanceRemediationStatus.VERIFIED,
        verifiedAt: now,
        auditTrail: this.orchestrator.appendAuditTrail(existing.auditTrail, {
          at: now.toISOString(),
          action: 'VERIFIED',
          actorUserId: accessContext.actorUserId,
          notes: notes ?? null,
        }),
      },
      include: { drift: true },
    });

    await this.auditService.logAction(
      accessContext.actorUserId,
      'CONTRACTOR_GOVERNANCE_REMEDIATION_VERIFIED',
      'ContractorGovernanceRemediation',
      remediationId,
      null,
      { notes },
      { organizationId },
    );

    return this.toDto(updated);
  }

  async close(
    accessContext: AccessContext,
    remediationId: string,
    dto: CloseContractorGovernanceRemediationDto,
  ): Promise<ContractorGovernanceRemediationItemDto> {
    const organizationId = this.resolveOrgId(accessContext);
    const existing = await this.loadRemediation(remediationId, organizationId);
    const now = new Date();

    const updated = await this.prisma.contractorGovernanceRemediation.update({
      where: { id: remediationId },
      data: {
        remediationStatus: ContractorGovernanceRemediationStatus.CLOSED,
        closedAt: now,
        pdpRestrictionsApplied: false,
        auditTrail: this.orchestrator.appendAuditTrail(existing.auditTrail, {
          at: now.toISOString(),
          action: 'CLOSED',
          actorUserId: accessContext.actorUserId,
          resolutionNotes: dto.resolutionNotes,
        }),
      },
      include: { drift: true },
    });

    await this.auditService.logAction(
      accessContext.actorUserId,
      'CONTRACTOR_GOVERNANCE_REMEDIATION_CLOSED',
      'ContractorGovernanceRemediation',
      remediationId,
      null,
      { resolutionNotes: dto.resolutionNotes },
      { organizationId },
    );

    return this.toDto(updated);
  }

  private async loadRemediation(remediationId: string, organizationId: string) {
    const row = await this.prisma.contractorGovernanceRemediation.findFirst({
      where: { id: remediationId, organizationId },
    });
    if (!row) {
      throw new NotFoundException('Remediation record not found');
    }
    return row;
  }

  private toDto(
    row: {
      id: string;
      organizationId: string;
      driftId: string;
      contractorId: string | null;
      remediationType: ContractorGovernanceRemediationItemDto['remediationType'];
      remediationStatus: ContractorGovernanceRemediationStatus;
      assignedToUserId: string | null;
      dueAt: Date | null;
      escalationLevel: number;
      pdpRestrictionsApplied: boolean;
      verifiedAt: Date | null;
      closedAt: Date | null;
      createdAt: Date;
      drift?: { driftType: string; severity: ContractorSourceDriftSeverity };
    },
  ): ContractorGovernanceRemediationItemDto {
    const ageHours =
      Math.round(((Date.now() - row.createdAt.getTime()) / (60 * 60 * 1000)) * 10) / 10;
    const isOverdue =
      row.dueAt != null &&
      row.dueAt.getTime() < Date.now() &&
      row.remediationStatus !== ContractorGovernanceRemediationStatus.CLOSED;

    const driftTypeLabel = formatDriftTypeLabel(row.drift?.driftType);
    const policyContext = row.pdpRestrictionsApplied
      ? resolvePolicyEvaluationContext(row.drift?.driftType)
      : null;

    return {
      id: row.id,
      organizationId: row.organizationId,
      driftId: row.driftId,
      contractorId: row.contractorId,
      remediationType: row.remediationType,
      remediationTypeLabel: formatRemediationTypeLabel(row.remediationType),
      remediationStatus: row.remediationStatus,
      assignedToUserId: row.assignedToUserId,
      dueAt: row.dueAt?.toISOString() ?? null,
      escalationLevel: row.escalationLevel,
      pdpRestrictionsApplied: row.pdpRestrictionsApplied,
      driftType: row.drift?.driftType,
      driftTypeLabel,
      driftSeverity: row.drift?.severity,
      verifiedAt: row.verifiedAt?.toISOString() ?? null,
      closedAt: row.closedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      ageHours,
      isOverdue,
      policyDecision: row.pdpRestrictionsApplied ? POLICY_DECISION_RESTRICTED : undefined,
      policyEvaluationReason: row.pdpRestrictionsApplied ? driftTypeLabel : undefined,
      policySourceTruth: policyContext?.sourceTruth,
      policyResolutionAction: policyContext?.resolutionAction,
      policyEvaluationSteps: row.pdpRestrictionsApplied
        ? buildPolicyEvaluationSteps(row.drift?.driftType, driftTypeLabel)
        : undefined,
    };
  }
}
