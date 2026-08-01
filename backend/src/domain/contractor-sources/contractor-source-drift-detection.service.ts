import { Injectable } from '@nestjs/common';
import {
  ContractorSourceDriftSeverity,
  ContractorSourceDriftStatus,
  ContractorSourceDriftType,
  GovernanceSignalCategory,
  ContractorSourceSyncRunMode,
  ContractorSourceSyncRunStatus,
  HcmContractorCorrelationConfidence,
  HcmContractorCorrelationMatchStatus,
  HcmStagingValidationStatus,
  MigrationSourceSystem,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import {
  isUpstreamHcmLifecycleDriftEnabled,
  isUpstreamHcmWorkerSourceDriftEnabled,
} from '../../core/authority/contractor-lifecycle-authority.util';
import { COMPARISON_ANCHOR_CONTRACTOR_EMAIL_PREFIX } from '../demo/connector-demo-comparison.constants';
import { SUPPORTED_HCM_WORKER_TYPES } from '../contractor-migration/constants/hcm-worker-types';
import { HcmContractorNormalizationService } from '../contractor-migration/services/hcm-contractor-normalization.service';
import { isUpstreamWorkforceTerminated } from './utils/hcm-workforce-risk.util';
import {
  buildContractorDriftFingerprint,
  OPEN_CONTRACTOR_DRIFT_STATUSES,
} from './contractor-source-drift.util';
import { buildContractorDriftLifecycleFields } from './governance-signal-lifecycle.util';

export type ContractorDriftDetectionCandidate = {
  driftType: ContractorSourceDriftType;
  severity: ContractorSourceDriftSeverity;
  contractorId?: string | null;
  stagingId?: string | null;
  sourcePersonId?: string | null;
  sourceSystem?: MigrationSourceSystem;
  sourceSnapshot?: Prisma.InputJsonValue;
  governanceSnapshot?: Prisma.InputJsonValue;
  correlationSnapshot?: Prisma.InputJsonValue;
};

export type ContractorDriftDetectionResult = {
  detected: number;
  updated: number;
};

/**
 * PR-CTR-CONNECTOR-1F — identity-governed drift detection (no auto-remediation).
 */
@Injectable()
export class ContractorSourceDriftDetectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly normalization: HcmContractorNormalizationService,
  ) {}

  private resolveNormalizedStaging(row: {
    sourcePersonId: string;
    sourcePersonNumber: string | null;
    sourcePayloadJson: unknown;
    normalizedPayloadJson: unknown;
  }): {
    email?: string | null;
    supplier?: string | null;
    workerType?: string | null;
    assignmentStatus?: string | null;
  } {
    if (row.normalizedPayloadJson != null && typeof row.normalizedPayloadJson === 'object') {
      return row.normalizedPayloadJson as {
        email?: string | null;
        supplier?: string | null;
        workerType?: string | null;
        assignmentStatus?: string | null;
      };
    }
    const payload =
      row.sourcePayloadJson != null && typeof row.sourcePayloadJson === 'object'
        ? (row.sourcePayloadJson as Record<string, unknown>)
        : {};
    return this.normalization.normalize(payload, {
      sourcePersonId: row.sourcePersonId,
      sourcePersonNumber: row.sourcePersonNumber,
    });
  }

  async detectForOrganization(
    organizationId: string,
    detectedByRunId?: string | null,
  ): Promise<ContractorDriftDetectionResult> {
    const candidates = await this.collectCandidates(organizationId, detectedByRunId);
    let detected = 0;
    let updated = 0;

    for (const candidate of candidates) {
      const outcome = await this.upsertDrift(organizationId, candidate, detectedByRunId);
      if (outcome === 'created') {
        detected += 1;
      } else if (outcome === 'updated') {
        updated += 1;
      }
    }

    await this.archiveExpiredBootstrapDrifts(organizationId);

    return { detected, updated };
  }

  private async archiveExpiredBootstrapDrifts(organizationId: string): Promise<void> {
    const now = new Date();
    await this.prisma.contractorSourceDrift.updateMany({
      where: {
        organizationId,
        signalCategory: GovernanceSignalCategory.BOOTSTRAP,
        status: { in: OPEN_CONTRACTOR_DRIFT_STATUSES },
        expiresAt: { lte: now },
      },
      data: {
        status: ContractorSourceDriftStatus.ARCHIVED,
        resolutionNotes: 'Auto-archived: bootstrap signal TTL elapsed (PR-GOV-SIGNAL-LIFECYCLE-1)',
        resolvedAt: now,
      },
    });
  }

  private async collectCandidates(
    organizationId: string,
    detectedByRunId?: string | null,
  ): Promise<ContractorDriftDetectionCandidate[]> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { contractorAuthorityMode: true },
    });
    const contractorAuthorityMode = org?.contractorAuthorityMode ?? 'CMS_ONLY';
    const upstreamLifecycleDriftEnabled =
      isUpstreamHcmLifecycleDriftEnabled(contractorAuthorityMode);
    const upstreamWorkerSourceDriftEnabled =
      isUpstreamHcmWorkerSourceDriftEnabled(contractorAuthorityMode);

    const candidates: ContractorDriftDetectionCandidate[] = [];
    const supplierIds = (
      await this.prisma.supplier.findMany({
        where: { organizationId },
        select: { id: true },
      })
    ).map((s) => s.id);

    const hcmContractorWhere =
      supplierIds.length > 0
        ? {
            supplierId: { in: supplierIds },
            legacySourceSystem: MigrationSourceSystem.ORACLE_HCM,
            legacySourcePersonId: { not: null },
          }
        : { id: { in: [] as string[] } };

    const [stagingRows, hcmContractors, duplicatePersonGroups, lastCompletedRun] =
      await Promise.all([
        this.prisma.hcmContractorStaging.findMany({
          where: { organizationId },
          select: {
            id: true,
            sourcePersonId: true,
            sourcePersonNumber: true,
            sourcePayloadJson: true,
            normalizedPayloadJson: true,
            correlationMatchStatus: true,
            correlationConfidence: true,
            correlationMatchReason: true,
            proposedContractorId: true,
            validationStatus: true,
            proposedContractor: {
              select: {
                id: true,
                isActive: true,
                email: true,
                legacySourcePersonId: true,
              },
            },
          },
        }),
        supplierIds.length > 0
          ? this.prisma.contractor.findMany({
              where: hcmContractorWhere,
              select: {
                id: true,
                isActive: true,
                email: true,
                legacySourcePersonId: true,
                firstName: true,
                lastName: true,
              },
            })
          : Promise.resolve([]),
        supplierIds.length > 0
          ? this.prisma.contractor.groupBy({
              by: ['legacySourcePersonId'],
              where: hcmContractorWhere,
              _count: { id: true },
              having: { id: { _count: { gt: 1 } } },
            })
          : Promise.resolve([]),
        this.prisma.contractorSourceSyncRun.findFirst({
          where: {
            organizationId,
            status: { not: ContractorSourceSyncRunStatus.RUNNING },
          },
          orderBy: { startedAt: 'desc' },
        }),
      ]);

    const stagingByPerson = new Map(stagingRows.map((r) => [r.sourcePersonId, r]));

    for (const row of stagingRows) {
      const normalized = this.resolveNormalizedStaging(row);

      const correlationSnapshot = {
        matchStatus: row.correlationMatchStatus,
        confidence: row.correlationConfidence,
        matchReason: row.correlationMatchReason,
        proposedContractorId: row.proposedContractorId,
      };

      if (row.correlationMatchStatus === HcmContractorCorrelationMatchStatus.CONFLICT) {
        candidates.push({
          driftType: ContractorSourceDriftType.PERSON_CORRELATION_CONFLICT,
          severity: ContractorSourceDriftSeverity.HIGH,
          stagingId: row.id,
          sourcePersonId: row.sourcePersonId,
          contractorId: row.proposedContractorId,
          correlationSnapshot,
          sourceSnapshot: { sourcePersonId: row.sourcePersonId },
        });
      }

      if (
        row.correlationConfidence === HcmContractorCorrelationConfidence.MANUAL_REVIEW
      ) {
        candidates.push({
          driftType: ContractorSourceDriftType.PERSON_CORRELATION_CONFLICT,
          severity: ContractorSourceDriftSeverity.HIGH,
          stagingId: row.id,
          sourcePersonId: row.sourcePersonId,
          contractorId: row.proposedContractorId,
          correlationSnapshot,
          sourceSnapshot: { manualReview: true },
        });
      }

      const workerType = normalized?.workerType?.toLowerCase() ?? '';
      const isExternalWorker =
        !workerType ||
        [...SUPPORTED_HCM_WORKER_TYPES].some((t) => workerType.includes(t));

      if (isExternalWorker && !normalized?.supplier?.trim()) {
        candidates.push({
          driftType: ContractorSourceDriftType.SUPPLIER_LINK_MISSING,
          severity: ContractorSourceDriftSeverity.HIGH,
          stagingId: row.id,
          sourcePersonId: row.sourcePersonId,
          sourceSnapshot: { workerType: normalized?.workerType ?? null },
          correlationSnapshot,
        });
      }

      const contractor = row.proposedContractor;
      if (
        upstreamLifecycleDriftEnabled &&
        contractor &&
        isUpstreamWorkforceTerminated(normalized) &&
        contractor.isActive
      ) {
        candidates.push({
          driftType: ContractorSourceDriftType.GOVERNANCE_LIFECYCLE_CONFLICT,
          severity: ContractorSourceDriftSeverity.CRITICAL,
          contractorId: contractor.id,
          stagingId: row.id,
          sourcePersonId: row.sourcePersonId,
          governanceSnapshot: {
            contractorId: contractor.id,
            isActive: true,
            assignmentStatus: normalized?.assignmentStatus ?? null,
          },
          sourceSnapshot: normalized ?? undefined,
          correlationSnapshot,
        });
      }

      if (
        upstreamWorkerSourceDriftEnabled &&
        contractor &&
        row.correlationMatchStatus === HcmContractorCorrelationMatchStatus.MATCHED &&
        normalized?.email &&
        contractor.email.toLowerCase() !== normalized.email.toLowerCase()
      ) {
        candidates.push({
          driftType: ContractorSourceDriftType.WORKER_SOURCE_DRIFT,
          severity: ContractorSourceDriftSeverity.MEDIUM,
          contractorId: contractor.id,
          stagingId: row.id,
          sourcePersonId: row.sourcePersonId,
          governanceSnapshot: {
            cmsEmail: contractor.email,
          },
          sourceSnapshot: { hcmEmail: normalized.email },
          correlationSnapshot,
        });
      }

      if (
        upstreamWorkerSourceDriftEnabled &&
        row.validationStatus === HcmStagingValidationStatus.FAILED &&
        contractor
      ) {
        candidates.push({
          driftType: ContractorSourceDriftType.WORKER_SOURCE_DRIFT,
          severity: ContractorSourceDriftSeverity.MEDIUM,
          contractorId: contractor.id,
          stagingId: row.id,
          sourcePersonId: row.sourcePersonId,
          sourceSnapshot: { validationStatus: row.validationStatus },
          governanceSnapshot: { contractorId: contractor.id },
        });
      }
    }

    for (const contractor of hcmContractors) {
      const personId = contractor.legacySourcePersonId!;
      const staging = stagingByPerson.get(personId);
      const stagingNormalized = staging
        ? this.resolveNormalizedStaging(staging)
        : null;
      if (
        upstreamLifecycleDriftEnabled &&
        contractor.isActive &&
        staging &&
        stagingNormalized &&
        isUpstreamWorkforceTerminated(stagingNormalized) &&
        !candidates.some(
          (c) =>
            c.driftType === ContractorSourceDriftType.GOVERNANCE_LIFECYCLE_CONFLICT &&
            c.contractorId === contractor.id,
        )
      ) {
        candidates.push({
          driftType: ContractorSourceDriftType.GOVERNANCE_LIFECYCLE_CONFLICT,
          severity: ContractorSourceDriftSeverity.CRITICAL,
          contractorId: contractor.id,
          stagingId: staging.id,
          sourcePersonId: personId,
          governanceSnapshot: {
            contractorId: contractor.id,
            isActive: true,
            assignmentStatus: stagingNormalized.assignmentStatus ?? null,
          },
          sourceSnapshot: stagingNormalized as Prisma.InputJsonValue,
        });
      }
    }

    if (supplierIds.length > 0) {
      const unsponsoredContractors = await this.prisma.contractor.findMany({
        where: {
          supplierId: { in: supplierIds },
          isActive: true,
          email: { not: { startsWith: COMPARISON_ANCHOR_CONTRACTOR_EMAIL_PREFIX } },
          engagements: {
            none: {
              isActive: true,
              responsibleManagerEmployeeId: { not: null },
            },
          },
        },
        select: {
          id: true,
          legacySourceSystem: true,
          legacySourcePersonId: true,
          email: true,
        },
      });

      for (const contractor of unsponsoredContractors) {
        if (
          candidates.some(
            (c) =>
              c.driftType === ContractorSourceDriftType.MISSING_RESPONSIBLE_MANAGER &&
              c.contractorId === contractor.id,
          )
        ) {
          continue;
        }
        candidates.push({
          driftType: ContractorSourceDriftType.MISSING_RESPONSIBLE_MANAGER,
          severity: ContractorSourceDriftSeverity.CRITICAL,
          contractorId: contractor.id,
          sourcePersonId: contractor.legacySourcePersonId,
          sourceSystem: contractor.legacySourceSystem ?? MigrationSourceSystem.CMS_NATIVE,
          governanceSnapshot: {
            contractorId: contractor.id,
            cmsGovernance: 'SPONSOR_ASSIGNMENT_REQUIRED',
            email: contractor.email,
          },
          sourceSnapshot: {
            bootstrapSource: contractor.legacySourceSystem ?? MigrationSourceSystem.CMS_NATIVE,
          },
        });
      }
    }

    for (const group of duplicatePersonGroups) {
      if (!group.legacySourcePersonId) continue;
      candidates.push({
        driftType: ContractorSourceDriftType.DUPLICATE_PERSON_ANCHOR,
        severity: ContractorSourceDriftSeverity.CRITICAL,
        sourcePersonId: group.legacySourcePersonId,
        governanceSnapshot: { duplicateCount: group._count.id },
        sourceSnapshot: { legacySourcePersonId: group.legacySourcePersonId },
      });
    }

    if (
      lastCompletedRun?.status === ContractorSourceSyncRunStatus.FAILED &&
      lastCompletedRun.mode === ContractorSourceSyncRunMode.INCREMENTAL &&
      lastCompletedRun.checkpointFrom != null &&
      lastCompletedRun.errorCode !== 'DISABLED'
    ) {
      candidates.push({
        driftType: ContractorSourceDriftType.CHECKPOINT_GAP,
        severity: ContractorSourceDriftSeverity.HIGH,
        sourceSnapshot: {
          syncRunId: lastCompletedRun.id,
          errorCode: lastCompletedRun.errorCode,
          errorMessage: lastCompletedRun.errorMessage,
          checkpointFrom: lastCompletedRun.checkpointFrom,
        },
        governanceSnapshot: { detectedByRunId: detectedByRunId ?? lastCompletedRun.id },
      });
    }

    return candidates;
  }

  private async upsertDrift(
    organizationId: string,
    candidate: ContractorDriftDetectionCandidate,
    detectedByRunId?: string | null,
  ): Promise<'created' | 'updated' | 'skipped'> {
    const driftFingerprint = buildContractorDriftFingerprint({
      organizationId,
      driftType: candidate.driftType,
      contractorId: candidate.contractorId,
      sourcePersonId: candidate.sourcePersonId,
      stagingId: candidate.stagingId,
    });

    const now = new Date();
    const lifecycle = buildContractorDriftLifecycleFields(candidate.driftType, now);
    const existing = await this.prisma.contractorSourceDrift.findUnique({
      where: {
        organizationId_driftFingerprint: {
          organizationId,
          driftFingerprint,
        },
      },
    });

    if (
      existing &&
      (OPEN_CONTRACTOR_DRIFT_STATUSES as ContractorSourceDriftStatus[]).includes(
        existing.status,
      )
    ) {
      await this.prisma.contractorSourceDrift.update({
        where: { id: existing.id },
        data: {
          severity: candidate.severity,
          detectedAt: now,
          detectedByRunId: detectedByRunId ?? existing.detectedByRunId,
          signalCategory: lifecycle.signalCategory,
          detectedPhase: lifecycle.detectedPhase,
          expiresAt: lifecycle.expiresAt,
          suppressAfterCutover: lifecycle.suppressAfterCutover,
          lineageOnly: lifecycle.lineageOnly,
          operationalImpact: lifecycle.operationalImpact,
          governanceOwner: lifecycle.governanceOwner,
          sourceSnapshot: candidate.sourceSnapshot ?? Prisma.JsonNull,
          governanceSnapshot: candidate.governanceSnapshot ?? Prisma.JsonNull,
          correlationSnapshot: candidate.correlationSnapshot ?? Prisma.JsonNull,
        },
      });
      return 'updated';
    }

    if (existing) {
      return 'skipped';
    }

    await this.prisma.contractorSourceDrift.create({
      data: {
        organizationId,
        contractorId: candidate.contractorId ?? null,
        stagingId: candidate.stagingId ?? null,
        sourceSystem: candidate.sourceSystem ?? MigrationSourceSystem.ORACLE_HCM,
        sourcePersonId: candidate.sourcePersonId ?? null,
        driftType: candidate.driftType,
        severity: candidate.severity,
        status: ContractorSourceDriftStatus.CLASSIFIED,
        signalCategory: lifecycle.signalCategory,
        detectedPhase: lifecycle.detectedPhase,
        expiresAt: lifecycle.expiresAt,
        suppressAfterCutover: lifecycle.suppressAfterCutover,
        lineageOnly: lifecycle.lineageOnly,
        operationalImpact: lifecycle.operationalImpact,
        governanceOwner: lifecycle.governanceOwner,
        driftFingerprint,
        detectedAt: now,
        classifiedAt: now,
        detectedByRunId: detectedByRunId ?? null,
        sourceSnapshot: candidate.sourceSnapshot ?? Prisma.JsonNull,
        governanceSnapshot: candidate.governanceSnapshot ?? Prisma.JsonNull,
        correlationSnapshot: candidate.correlationSnapshot ?? Prisma.JsonNull,
      },
    });

    return 'created';
  }
}
