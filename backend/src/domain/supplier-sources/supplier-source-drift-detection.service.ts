import { Injectable } from '@nestjs/common';
import {
  Prisma,
  SupplierSourceDriftSeverity,
  SupplierSourceDriftStatus,
  SupplierSourceDriftType,
  SupplierSourceStagingMatchStatus,
  SupplierSourceSyncRunStatus,
  SupplierSourceSyncStatus,
  SupplierSourceSystem,
  SupplierStatus,
} from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import {
  buildDriftFingerprint,
  OPEN_DRIFT_STATUSES,
} from './supplier-source-drift.util';

export type DriftDetectionCandidate = {
  driftType: SupplierSourceDriftType;
  severity: SupplierSourceDriftSeverity;
  supplierId?: string | null;
  stagingId?: string | null;
  externalSupplierId?: string | null;
  sourceSnapshot?: Prisma.InputJsonValue;
  governanceSnapshot?: Prisma.InputJsonValue;
};

export type DriftDetectionResult = {
  detected: number;
  updated: number;
};

/**
 * PR-CMS-CONNECTOR-4B — drift detection engine (no auto-remediation).
 */
@Injectable()
export class SupplierSourceDriftDetectionService {
  constructor(private readonly prisma: PrismaService) {}

  async detectForOrganization(
    organizationId: string,
    detectedByRunId?: string | null,
  ): Promise<DriftDetectionResult> {
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

    return { detected, updated };
  }

  private async collectCandidates(
    organizationId: string,
    detectedByRunId?: string | null,
  ): Promise<DriftDetectionCandidate[]> {
    const candidates: DriftDetectionCandidate[] = [];
    const oracleWhere = {
      organizationId,
      sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
      externalSupplierId: { not: null },
    };

    const [
      oracleSuppliers,
      stagingRows,
      duplicateGroups,
      lastCompletedRun,
    ] = await Promise.all([
      this.prisma.supplier.findMany({
        where: oracleWhere,
        select: {
          id: true,
          externalSupplierId: true,
          status: true,
          sourceSyncStatus: true,
          companyName: true,
          tradingName: true,
          sourceLastSyncedAt: true,
        },
      }),
      this.prisma.supplierSourceStaging.findMany({
        where: { organizationId },
        select: {
          id: true,
          externalSupplierId: true,
          matchStatus: true,
          matchReason: true,
          proposedSupplierId: true,
          name: true,
        },
      }),
      this.prisma.supplier.groupBy({
        by: ['externalSupplierId'],
        where: {
          ...oracleWhere,
        },
        _count: { id: true },
        having: { id: { _count: { gt: 1 } } },
      }),
      this.prisma.supplierSourceSyncRun.findFirst({
        where: {
          organizationId,
          status: { not: SupplierSourceSyncRunStatus.RUNNING },
        },
        orderBy: { startedAt: 'desc' },
      }),
    ]);

    const stagingByExternal = new Map(
      stagingRows.map((r) => [r.externalSupplierId, r]),
    );

    for (const supplier of oracleSuppliers) {
      const extId = supplier.externalSupplierId!;
      const gov = {
        supplierId: supplier.id,
        status: supplier.status,
        sourceSyncStatus: supplier.sourceSyncStatus,
        displayName: supplier.companyName ?? supplier.tradingName,
        sourceLastSyncedAt: supplier.sourceLastSyncedAt,
      };

      if (
        supplier.status === SupplierStatus.ACTIVE &&
        supplier.sourceSyncStatus !== SupplierSourceSyncStatus.SYNCED
      ) {
        candidates.push({
          driftType: SupplierSourceDriftType.GOVERNANCE_STATE_CONFLICT,
          severity: SupplierSourceDriftSeverity.CRITICAL,
          supplierId: supplier.id,
          externalSupplierId: extId,
          governanceSnapshot: gov,
          sourceSnapshot: stagingByExternal.get(extId) ?? { missingStaging: true },
        });
        continue;
      }

      if (supplier.sourceSyncStatus !== SupplierSourceSyncStatus.SYNCED) {
        candidates.push({
          driftType: SupplierSourceDriftType.SUPPLIER_SOURCE_DRIFT,
          severity: SupplierSourceDriftSeverity.MEDIUM,
          supplierId: supplier.id,
          externalSupplierId: extId,
          governanceSnapshot: gov,
          sourceSnapshot: stagingByExternal.get(extId) ?? undefined,
        });
      }

      if (!stagingByExternal.has(extId)) {
        candidates.push({
          driftType: SupplierSourceDriftType.SOURCE_RECORD_MISSING,
          severity: SupplierSourceDriftSeverity.HIGH,
          supplierId: supplier.id,
          externalSupplierId: extId,
          governanceSnapshot: gov,
          sourceSnapshot: { stagingAbsent: true },
        });
      }
    }

    for (const row of stagingRows) {
      if (row.matchStatus === SupplierSourceStagingMatchStatus.CONFLICT) {
        candidates.push({
          driftType: SupplierSourceDriftType.RECONCILIATION_CONFLICT,
          severity: SupplierSourceDriftSeverity.HIGH,
          stagingId: row.id,
          externalSupplierId: row.externalSupplierId,
          supplierId: row.proposedSupplierId,
          sourceSnapshot: {
            matchStatus: row.matchStatus,
            matchReason: row.matchReason,
            name: row.name,
          },
        });
      } else if (row.matchStatus === SupplierSourceStagingMatchStatus.POSSIBLE_MATCH) {
        candidates.push({
          driftType: SupplierSourceDriftType.RECONCILIATION_CONFLICT,
          severity: SupplierSourceDriftSeverity.MEDIUM,
          stagingId: row.id,
          externalSupplierId: row.externalSupplierId,
          supplierId: row.proposedSupplierId,
          sourceSnapshot: {
            matchStatus: row.matchStatus,
            matchReason: row.matchReason,
            name: row.name,
          },
        });
      }
    }

    for (const group of duplicateGroups) {
      if (!group.externalSupplierId) continue;
      candidates.push({
        driftType: SupplierSourceDriftType.DUPLICATE_EXTERNAL_ID,
        severity: SupplierSourceDriftSeverity.CRITICAL,
        externalSupplierId: group.externalSupplierId,
        sourceSnapshot: { duplicateCount: group._count.id },
      });
    }

    if (
      lastCompletedRun?.status === SupplierSourceSyncRunStatus.FAILED &&
      lastCompletedRun.checkpointFrom != null
    ) {
      candidates.push({
        driftType: SupplierSourceDriftType.CHECKPOINT_GAP,
        severity: SupplierSourceDriftSeverity.HIGH,
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
    candidate: DriftDetectionCandidate,
    detectedByRunId?: string | null,
  ): Promise<'created' | 'updated' | 'skipped'> {
    const driftFingerprint = buildDriftFingerprint({
      organizationId,
      driftType: candidate.driftType,
      supplierId: candidate.supplierId,
      externalSupplierId: candidate.externalSupplierId,
      stagingId: candidate.stagingId,
    });

    const now = new Date();
    const existing = await this.prisma.supplierSourceDrift.findUnique({
      where: {
        organizationId_driftFingerprint: {
          organizationId,
          driftFingerprint,
        },
      },
    });

    if (existing && (OPEN_DRIFT_STATUSES as SupplierSourceDriftStatus[]).includes(existing.status)) {
      await this.prisma.supplierSourceDrift.update({
        where: { id: existing.id },
        data: {
          severity: candidate.severity,
          detectedAt: now,
          detectedByRunId: detectedByRunId ?? existing.detectedByRunId,
          sourceSnapshot: candidate.sourceSnapshot ?? Prisma.JsonNull,
          governanceSnapshot: candidate.governanceSnapshot ?? Prisma.JsonNull,
        },
      });
      return 'updated';
    }

    if (existing) {
      return 'skipped';
    }

    await this.prisma.supplierSourceDrift.create({
      data: {
        organizationId,
        supplierId: candidate.supplierId ?? null,
        stagingId: candidate.stagingId ?? null,
        sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
        externalSupplierId: candidate.externalSupplierId ?? null,
        driftType: candidate.driftType,
        severity: candidate.severity,
        status: SupplierSourceDriftStatus.CLASSIFIED,
        driftFingerprint,
        detectedAt: now,
        classifiedAt: now,
        detectedByRunId: detectedByRunId ?? null,
        sourceSnapshot: candidate.sourceSnapshot ?? Prisma.JsonNull,
        governanceSnapshot: candidate.governanceSnapshot ?? Prisma.JsonNull,
      },
    });

    return 'created';
  }
}
