import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContractorSourceDriftSeverity,
  ContractorSourceDriftStatus,
  ContractorSourceDriftType,
  Prisma,
  SignalLifecycleState,
} from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import {
  CRITICAL_WORKFORCE_DRIFT_AGE_HOURS,
  OPEN_CONTRACTOR_DRIFT_STATUSES,
} from './contractor-source-drift.util';
import {
  AssignContractorSourceDriftDto,
  ContractorSourceDriftItemDto,
  ContractorSourceDriftSummaryDto,
  DetectContractorSourceDriftResponseDto,
  PaginatedContractorSourceDriftResponseDto,
} from './dto/contractor-source-drift.dto';
import { ContractorSourceDriftDetectionService } from './contractor-source-drift-detection.service';
import { ContractorGovernanceRemediationOrchestratorService } from '../contractor-governance/contractor-governance-remediation-orchestrator.service';
import {
  buildOpenOperationalDriftWhere,
  buildOperationalDriftVisibilityWhere,
} from './governance-signal-lifecycle.util';
import { WorkforceAssessmentService } from './workforce-assessment.service';
import { HcmSupplierReferenceReconciliationService } from '../supplier-sources/hcm-supplier-reference-reconciliation.service';

@Injectable()
export class ContractorSourceDriftService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly detection: ContractorSourceDriftDetectionService,
    private readonly remediationOrchestrator: ContractorGovernanceRemediationOrchestratorService,
    private readonly workforceAssessment: WorkforceAssessmentService,
    private readonly hcmSupplierReferenceReconciliation: HcmSupplierReferenceReconciliationService,
  ) {}

  private resolveOrgId(accessContext: AccessContext): string {
    const orgId = accessContext.targetOrganizationId;
    if (!orgId) {
      throw new BadRequestException('Organization context is required');
    }
    return orgId;
  }

  private async loadCutoverContext(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { workforceMigrationCutoverAt: true },
    });
    return { workforceMigrationCutoverAt: org?.workforceMigrationCutoverAt ?? null };
  }

  async runDetection(
    accessContext: AccessContext,
    detectedByRunId?: string | null,
  ): Promise<DetectContractorSourceDriftResponseDto> {
    const organizationId = this.resolveOrgId(accessContext);
    const assessmentStatus =
      await this.workforceAssessment.resolveStatus(organizationId);

    if (!assessmentStatus.canRunAssessment) {
      if (assessmentStatus.lifecyclePhase === 'DISCOVERY_PENDING') {
        throw new ConflictException(
          'Workforce discovery must complete before running workforce assessment.',
        );
      }
      throw new ConflictException(
        'Workforce assessment is already up to date for the latest discovery snapshot.',
      );
    }

    const discoveryRunId =
      detectedByRunId ?? assessmentStatus.latestDiscoveryRun!.id;

    const result = await this.detection.detectForOrganization(
      organizationId,
      discoveryRunId,
    );
    await this.workforceAssessment.recordCompletion(organizationId, discoveryRunId);
    await this.hcmSupplierReferenceReconciliation.syncObservations(
      organizationId,
      discoveryRunId,
    );
    const remediations = await this.remediationOrchestrator.syncRemediationsForOrganization(
      organizationId,
      accessContext.actorUserId,
    );
    return {
      organizationId,
      detected: result.detected,
      updated: result.updated,
      remediationsCreated: remediations.created,
      evaluatedAt: new Date().toISOString(),
      discoverySnapshotRef: assessmentStatus.latestDiscoveryRun!.snapshotRef,
    };
  }

  async getSummary(
    accessContext: AccessContext,
    options?: { operationalOnly?: boolean },
  ): Promise<ContractorSourceDriftSummaryDto> {
    const organizationId = this.resolveOrgId(accessContext);
    const cutover = await this.loadCutoverContext(organizationId);
    const operationalOnly = options?.operationalOnly ?? true;
    const openWhere = buildOpenOperationalDriftWhere(
      organizationId,
      cutover,
      operationalOnly,
    );

    const [
      critical,
      high,
      medium,
      low,
      underReview,
      criticalAged,
      lifecycleConflictOpen,
      missingResponsibleManagerOpen,
      identityConflictOpen,
      supplierLinkMissingOpen,
    ] = await Promise.all([
      this.prisma.contractorSourceDrift.count({
        where: { ...openWhere, severity: ContractorSourceDriftSeverity.CRITICAL },
      }),
      this.prisma.contractorSourceDrift.count({
        where: { ...openWhere, severity: ContractorSourceDriftSeverity.HIGH },
      }),
      this.prisma.contractorSourceDrift.count({
        where: { ...openWhere, severity: ContractorSourceDriftSeverity.MEDIUM },
      }),
      this.prisma.contractorSourceDrift.count({
        where: { ...openWhere, severity: ContractorSourceDriftSeverity.LOW },
      }),
      this.prisma.contractorSourceDrift.count({
        where: {
          ...openWhere,
          status: ContractorSourceDriftStatus.UNDER_REVIEW,
        },
      }),
      this.prisma.contractorSourceDrift.count({
        where: {
          ...openWhere,
          severity: ContractorSourceDriftSeverity.CRITICAL,
          detectedAt: {
            lte: new Date(
              Date.now() - CRITICAL_WORKFORCE_DRIFT_AGE_HOURS * 60 * 60 * 1000,
            ),
          },
        },
      }),
      this.prisma.contractorSourceDrift.count({
        where: {
          ...openWhere,
          driftType: ContractorSourceDriftType.GOVERNANCE_LIFECYCLE_CONFLICT,
        },
      }),
      this.prisma.contractorSourceDrift.count({
        where: {
          ...openWhere,
          driftType: ContractorSourceDriftType.MISSING_RESPONSIBLE_MANAGER,
        },
      }),
      this.prisma.contractorSourceDrift.count({
        where: {
          ...openWhere,
          driftType: {
            in: [
              ContractorSourceDriftType.PERSON_CORRELATION_CONFLICT,
              ContractorSourceDriftType.DUPLICATE_PERSON_ANCHOR,
            ],
          },
        },
      }),
      this.prisma.contractorSourceDrift.count({
        where: {
          ...openWhere,
          driftType: ContractorSourceDriftType.SUPPLIER_LINK_MISSING,
        },
      }),
    ]);

    return {
      organizationId,
      critical,
      high,
      medium,
      low,
      underReview,
      openTotal: critical + high + medium + low,
      criticalUnresolvedOver24h: criticalAged,
      lifecycleConflictOpen,
      missingResponsibleManagerOpen,
      identityConflictOpen,
      supplierLinkMissingOpen,
      evaluatedAt: new Date().toISOString(),
    };
  }

  async listDrifts(
    accessContext: AccessContext,
    query: {
      status?: ContractorSourceDriftStatus;
      severity?: ContractorSourceDriftSeverity;
      driftType?: ContractorSourceDriftType;
      operationalOnly?: boolean;
      page?: number;
      limit?: number;
    },
  ): Promise<PaginatedContractorSourceDriftResponseDto> {
    const organizationId = this.resolveOrgId(accessContext);
    const cutover = await this.loadCutoverContext(organizationId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const operationalOnly = query.operationalOnly ?? true;

    const where: Prisma.ContractorSourceDriftWhereInput = {
      ...buildOperationalDriftVisibilityWhere(organizationId, cutover, operationalOnly),
      ...(query.status ? { status: query.status } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.driftType ? { driftType: query.driftType } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.contractorSourceDrift.findMany({
        where,
        orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.contractorSourceDrift.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toDto(row)),
      total,
      page,
      limit,
    };
  }

  async getDrift(
    accessContext: AccessContext,
    driftId: string,
  ): Promise<ContractorSourceDriftItemDto> {
    const organizationId = this.resolveOrgId(accessContext);
    const row = await this.prisma.contractorSourceDrift.findFirst({
      where: { id: driftId, organizationId },
    });
    if (!row) {
      throw new NotFoundException('Drift record not found');
    }
    return this.toDto(row);
  }

  async assignDrift(
    accessContext: AccessContext,
    driftId: string,
    assignedToUserId: string,
  ): Promise<ContractorSourceDriftItemDto> {
    const organizationId = this.resolveOrgId(accessContext);
    const existing = await this.prisma.contractorSourceDrift.findFirst({
      where: { id: driftId, organizationId },
    });
    if (!existing) {
      throw new NotFoundException('Drift record not found');
    }
    if (
      existing.status === ContractorSourceDriftStatus.RESOLVED ||
      existing.status === ContractorSourceDriftStatus.ARCHIVED
    ) {
      throw new BadRequestException('Cannot assign a resolved drift record');
    }

    const now = new Date();
    const updated = await this.prisma.contractorSourceDrift.update({
      where: { id: driftId },
      data: {
        assignedToUserId,
        status: ContractorSourceDriftStatus.UNDER_REVIEW,
        reviewedAt: now,
      },
    });
    return this.toDto(updated);
  }

  async resolveDrift(
    accessContext: AccessContext,
    driftId: string,
    resolutionNotes: string,
  ): Promise<ContractorSourceDriftItemDto> {
    const organizationId = this.resolveOrgId(accessContext);
    const existing = await this.prisma.contractorSourceDrift.findFirst({
      where: { id: driftId, organizationId },
    });
    if (!existing) {
      throw new NotFoundException('Drift record not found');
    }
    if (
      existing.status === ContractorSourceDriftStatus.RESOLVED ||
      existing.status === ContractorSourceDriftStatus.ARCHIVED
    ) {
      throw new BadRequestException('Drift record is already closed');
    }

    const now = new Date();
    const updated = await this.prisma.contractorSourceDrift.update({
      where: { id: driftId },
      data: {
        status: ContractorSourceDriftStatus.RESOLVED,
        resolutionNotes,
        resolvedAt: now,
      },
    });
    return this.toDto(updated);
  }

  private toDto(row: {
    id: string;
    organizationId: string;
    contractorId: string | null;
    stagingId: string | null;
    sourceSystem: ContractorSourceDriftItemDto['sourceSystem'];
    sourcePersonId: string | null;
    driftType: ContractorSourceDriftType;
    severity: ContractorSourceDriftSeverity;
    status: ContractorSourceDriftStatus;
    signalCategory: ContractorSourceDriftItemDto['signalCategory'];
    detectedPhase: ContractorSourceDriftItemDto['detectedPhase'];
    expiresAt: Date | null;
    suppressAfterCutover: boolean;
    lineageOnly: boolean;
    operationalImpact: ContractorSourceDriftItemDto['operationalImpact'];
    governanceOwner: ContractorSourceDriftItemDto['governanceOwner'];
    detectedAt: Date;
    classifiedAt: Date | null;
    reviewedAt: Date | null;
    resolvedAt: Date | null;
    detectedByRunId: string | null;
    resolutionNotes: string | null;
    assignedToUserId: string | null;
    signalLifecycleState: SignalLifecycleState;
    decayStartedAt: Date | null;
    archivedAt: Date | null;
    archivedReason: string | null;
    retentionUntil: Date | null;
  }): ContractorSourceDriftItemDto {
    const ageHours =
      Math.round(((Date.now() - row.detectedAt.getTime()) / (60 * 60 * 1000)) * 10) / 10;

    return {
      id: row.id,
      organizationId: row.organizationId,
      contractorId: row.contractorId,
      stagingId: row.stagingId,
      sourceSystem: row.sourceSystem,
      sourcePersonId: row.sourcePersonId,
      driftType: row.driftType,
      severity: row.severity,
      status: row.status,
      signalCategory: row.signalCategory,
      detectedPhase: row.detectedPhase,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      suppressAfterCutover: row.suppressAfterCutover,
      lineageOnly: row.lineageOnly,
      operationalImpact: row.operationalImpact,
      governanceOwner: row.governanceOwner,
      detectedAt: row.detectedAt.toISOString(),
      classifiedAt: row.classifiedAt?.toISOString() ?? null,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      detectedByRunId: row.detectedByRunId,
      resolutionNotes: row.resolutionNotes,
      assignedToUserId: row.assignedToUserId,
      ageHours,
      signalLifecycleState: row.signalLifecycleState,
      decayStartedAt: row.decayStartedAt?.toISOString() ?? null,
      archivedAt: row.archivedAt?.toISOString() ?? null,
      archivedReason: row.archivedReason,
      retentionUntil: row.retentionUntil?.toISOString() ?? null,
    };
  }
}
