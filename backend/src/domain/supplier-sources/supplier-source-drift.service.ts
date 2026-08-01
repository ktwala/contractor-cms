import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  SupplierSourceDriftSeverity,
  SupplierSourceDriftStatus,
  SupplierSourceDriftType,
} from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import {
  CRITICAL_DRIFT_AGE_HOURS,
  OPEN_DRIFT_STATUSES,
} from './supplier-source-drift.util';
import {
  DetectSupplierSourceDriftResponseDto,
  PaginatedSupplierSourceDriftResponseDto,
  SupplierSourceDriftItemDto,
  SupplierSourceDriftSummaryDto,
} from './dto/supplier-source-drift.dto';
import { SupplierSourceDriftDetectionService } from './supplier-source-drift-detection.service';
import { SupplierSyncAssessmentService } from './supplier-sync-assessment.service';
import { DemoSupplierGovernanceSetupService } from '../demo/demo-supplier-governance-setup.service';

@Injectable()
export class SupplierSourceDriftService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly detection: SupplierSourceDriftDetectionService,
    private readonly syncAssessment: SupplierSyncAssessmentService,
    private readonly demoSupplierGovernanceSetup: DemoSupplierGovernanceSetupService,
  ) {}

  private resolveOrgId(accessContext: AccessContext): string {
    const orgId = accessContext.targetOrganizationId;
    if (!orgId) {
      throw new BadRequestException('Organization context is required');
    }
    return orgId;
  }

  async runDetection(
    accessContext: AccessContext,
    detectedByRunId?: string | null,
  ): Promise<DetectSupplierSourceDriftResponseDto> {
    const organizationId = this.resolveOrgId(accessContext);
    const assessmentStatus = await this.syncAssessment.resolveStatus(organizationId);

    if (!assessmentStatus.canRunAssessment) {
      if (assessmentStatus.lifecyclePhase === 'SYNCHRONIZATION_PENDING') {
        throw new ConflictException(
          'Supplier synchronization must complete before running supplier readiness assessment.',
        );
      }
      throw new ConflictException(
        'Supplier readiness assessment is already up to date for the latest sync snapshot.',
      );
    }

    const syncRunId = detectedByRunId ?? assessmentStatus.latestSyncRun!.id;

    await this.syncAssessment.recordCompletion(organizationId, syncRunId);
    await this.demoSupplierGovernanceSetup.materializeGovernanceDemoIfNeeded(
      accessContext,
    );
    const result = await this.detection.detectForOrganization(
      organizationId,
      syncRunId,
    );

    return {
      organizationId,
      detected: result.detected,
      updated: result.updated,
      evaluatedAt: new Date().toISOString(),
      syncSnapshotRef: assessmentStatus.latestSyncRun!.snapshotRef,
    };
  }

  async getSummary(accessContext: AccessContext): Promise<SupplierSourceDriftSummaryDto> {
    const organizationId = this.resolveOrgId(accessContext);
    const openWhere: Prisma.SupplierSourceDriftWhereInput = {
      organizationId,
      status: { in: OPEN_DRIFT_STATUSES },
    };

    const [critical, high, medium, low, underReview, criticalAged] =
      await Promise.all([
        this.prisma.supplierSourceDrift.count({
          where: { ...openWhere, severity: SupplierSourceDriftSeverity.CRITICAL },
        }),
        this.prisma.supplierSourceDrift.count({
          where: { ...openWhere, severity: SupplierSourceDriftSeverity.HIGH },
        }),
        this.prisma.supplierSourceDrift.count({
          where: { ...openWhere, severity: SupplierSourceDriftSeverity.MEDIUM },
        }),
        this.prisma.supplierSourceDrift.count({
          where: { ...openWhere, severity: SupplierSourceDriftSeverity.LOW },
        }),
        this.prisma.supplierSourceDrift.count({
          where: {
            organizationId,
            status: SupplierSourceDriftStatus.UNDER_REVIEW,
          },
        }),
        this.prisma.supplierSourceDrift.count({
          where: {
            ...openWhere,
            severity: SupplierSourceDriftSeverity.CRITICAL,
            detectedAt: {
              lte: new Date(Date.now() - CRITICAL_DRIFT_AGE_HOURS * 60 * 60 * 1000),
            },
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
      criticalUnresolvedOver72h: criticalAged,
      evaluatedAt: new Date().toISOString(),
    };
  }

  async listDrifts(
    accessContext: AccessContext,
    query: {
      status?: SupplierSourceDriftStatus;
      severity?: SupplierSourceDriftSeverity;
      driftType?: SupplierSourceDriftType;
      page?: number;
      limit?: number;
    },
  ): Promise<PaginatedSupplierSourceDriftResponseDto> {
    const organizationId = this.resolveOrgId(accessContext);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.SupplierSourceDriftWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.driftType ? { driftType: query.driftType } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.supplierSourceDrift.findMany({
        where,
        orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.supplierSourceDrift.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toDto(row)),
      total,
      page,
      limit,
    };
  }

  async getDrift(accessContext: AccessContext, driftId: string): Promise<SupplierSourceDriftItemDto> {
    const organizationId = this.resolveOrgId(accessContext);
    const row = await this.prisma.supplierSourceDrift.findFirst({
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
  ): Promise<SupplierSourceDriftItemDto> {
    const organizationId = this.resolveOrgId(accessContext);
    const existing = await this.prisma.supplierSourceDrift.findFirst({
      where: { id: driftId, organizationId },
    });
    if (!existing) {
      throw new NotFoundException('Drift record not found');
    }
    if (
      existing.status === SupplierSourceDriftStatus.RESOLVED ||
      existing.status === SupplierSourceDriftStatus.ARCHIVED
    ) {
      throw new BadRequestException('Cannot assign a resolved drift record');
    }

    const now = new Date();
    const updated = await this.prisma.supplierSourceDrift.update({
      where: { id: driftId },
      data: {
        assignedToUserId,
        status: SupplierSourceDriftStatus.UNDER_REVIEW,
        reviewedAt: now,
      },
    });
    return this.toDto(updated);
  }

  async resolveDrift(
    accessContext: AccessContext,
    driftId: string,
    resolutionNotes: string,
  ): Promise<SupplierSourceDriftItemDto> {
    const organizationId = this.resolveOrgId(accessContext);
    const existing = await this.prisma.supplierSourceDrift.findFirst({
      where: { id: driftId, organizationId },
    });
    if (!existing) {
      throw new NotFoundException('Drift record not found');
    }
    if (
      existing.status === SupplierSourceDriftStatus.RESOLVED ||
      existing.status === SupplierSourceDriftStatus.ARCHIVED
    ) {
      throw new BadRequestException('Drift record is already closed');
    }

    const now = new Date();
    const updated = await this.prisma.supplierSourceDrift.update({
      where: { id: driftId },
      data: {
        status: SupplierSourceDriftStatus.RESOLVED,
        resolutionNotes,
        resolvedAt: now,
      },
    });
    return this.toDto(updated);
  }

  private toDto(row: {
    id: string;
    organizationId: string;
    supplierId: string | null;
    stagingId: string | null;
    sourceSystem: SupplierSourceDriftItemDto['sourceSystem'];
    externalSupplierId: string | null;
    driftType: SupplierSourceDriftType;
    severity: SupplierSourceDriftSeverity;
    status: SupplierSourceDriftStatus;
    detectedAt: Date;
    classifiedAt: Date | null;
    reviewedAt: Date | null;
    resolvedAt: Date | null;
    detectedByRunId: string | null;
    resolutionNotes: string | null;
    assignedToUserId: string | null;
  }): SupplierSourceDriftItemDto {
    const ageHours =
      Math.round(((Date.now() - row.detectedAt.getTime()) / (60 * 60 * 1000)) * 10) / 10;

    return {
      id: row.id,
      organizationId: row.organizationId,
      supplierId: row.supplierId,
      stagingId: row.stagingId,
      sourceSystem: row.sourceSystem,
      externalSupplierId: row.externalSupplierId,
      driftType: row.driftType,
      severity: row.severity,
      status: row.status,
      detectedAt: row.detectedAt.toISOString(),
      classifiedAt: row.classifiedAt?.toISOString() ?? null,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      detectedByRunId: row.detectedByRunId,
      resolutionNotes: row.resolutionNotes,
      assignedToUserId: row.assignedToUserId,
      ageHours,
    };
  }
}
