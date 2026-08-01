import { Injectable } from '@nestjs/common';
import { SupplierSourceSyncRunStatus } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import {
  SupplierDiscoverySnapshotHistoryItemDto,
  SupplierSnapshotAssessmentLabel,
} from './dto/supplier-discovery-snapshot-history.dto';
import {
  SupplierSyncAssessmentLifecyclePhase,
  SupplierSyncAssessmentStatusDto,
} from './dto/supplier-sync-assessment-status.dto';
import {
  formatSupplierSyncSnapshotRef,
  isSuccessfulSupplierSyncRun,
  supplierSyncSnapshotSequenceFromRuns,
} from './supplier-sync-snapshot.util';

type SyncRunRow = {
  id: string;
  importedCount: number;
  finishedAt: Date;
};

@Injectable()
export class SupplierSyncAssessmentService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveStatus(organizationId: string): Promise<SupplierSyncAssessmentStatusDto> {
    const [org, latestRun, successfulRuns] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          supplierLastAssessedSyncRunId: true,
          supplierLastAssessedAt: true,
        },
      }),
      this.prisma.supplierSourceSyncRun.findFirst({
        where: {
          organizationId,
          status: SupplierSourceSyncRunStatus.SUCCEEDED,
          finishedAt: { not: null },
        },
        orderBy: { finishedAt: 'desc' },
        select: {
          id: true,
          importedCount: true,
          finishedAt: true,
        },
      }),
      this.loadSuccessfulRunSequence(organizationId),
    ]);

    const latestSyncRun = latestRun?.finishedAt
      ? this.toSnapshotDto(
          {
            id: latestRun.id,
            importedCount: latestRun.importedCount,
            finishedAt: latestRun.finishedAt,
          },
          successfulRuns,
        )
      : null;

    const lastAssessment = await this.buildLastAssessment(
      organizationId,
      org?.supplierLastAssessedSyncRunId ?? null,
      org?.supplierLastAssessedAt ?? null,
      successfulRuns,
    );

    let lifecyclePhase: SupplierSyncAssessmentLifecyclePhase;
    if (!latestSyncRun) {
      lifecyclePhase = 'SYNCHRONIZATION_PENDING';
    } else if (
      !org?.supplierLastAssessedSyncRunId ||
      org.supplierLastAssessedSyncRunId !== latestSyncRun.id
    ) {
      lifecyclePhase = 'ASSESSMENT_PENDING';
    } else {
      lifecyclePhase = 'ASSESSMENT_CURRENT';
    }

    return {
      lifecyclePhase,
      canRunAssessment: lifecyclePhase === 'ASSESSMENT_PENDING',
      latestSyncRun,
      lastAssessment,
      findingsSnapshotRef: lastAssessment?.snapshotRef ?? null,
    };
  }

  async listSnapshotHistory(
    organizationId: string,
    limit = 20,
  ): Promise<SupplierDiscoverySnapshotHistoryItemDto[]> {
    const [org, successfulRuns, runs] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { supplierLastAssessedSyncRunId: true },
      }),
      this.loadSuccessfulRunSequence(organizationId),
      this.prisma.supplierSourceSyncRun.findMany({
        where: {
          organizationId,
          status: SupplierSourceSyncRunStatus.SUCCEEDED,
          finishedAt: { not: null },
        },
        orderBy: { finishedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          status: true,
          finishedAt: true,
          importedCount: true,
          matchedCount: true,
          newCount: true,
          failedCount: true,
        },
      }),
    ]);

    const latestRunId = runs[0]?.id ?? null;
    const assessedRunId = org?.supplierLastAssessedSyncRunId ?? null;

    return runs.map((run) => {
      const sequence = supplierSyncSnapshotSequenceFromRuns(successfulRuns, run.id) ?? 1;
      const unchangedSuppliers = Math.max(
        0,
        run.importedCount - run.newCount - run.matchedCount - run.failedCount,
      );

      let assessmentLabel: SupplierSnapshotAssessmentLabel;
      if (run.id === assessedRunId) {
        assessmentLabel = 'Assessed';
      } else if (run.id === latestRunId) {
        assessmentLabel = 'Pending';
      } else {
        assessmentLabel = 'Not assessed';
      }

      return {
        id: run.id,
        snapshotRef: formatSupplierSyncSnapshotRef(sequence),
        createdAt: run.finishedAt!.toISOString(),
        source: 'Oracle Supplier Portal',
        status: run.status,
        suppliersDiscovered: run.importedCount,
        newSuppliers: run.newCount,
        matchedSuppliers: run.matchedCount,
        unchangedSuppliers,
        failedSuppliers: run.failedCount,
        discoveryExceptions: unchangedSuppliers,
        assessmentLabel,
        isLatest: run.id === latestRunId,
      };
    });
  }

  async recordCompletion(organizationId: string, syncRunId: string): Promise<void> {
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        supplierLastAssessedSyncRunId: syncRunId,
        supplierLastAssessedAt: new Date(),
      },
    });
  }

  private async loadSuccessfulRunSequence(organizationId: string) {
    return this.prisma.supplierSourceSyncRun.findMany({
      where: {
        organizationId,
        status: SupplierSourceSyncRunStatus.SUCCEEDED,
        finishedAt: { not: null },
      },
      orderBy: { finishedAt: 'asc' },
      select: { id: true },
    });
  }

  private toSnapshotDto(run: SyncRunRow, successfulRuns: Array<{ id: string }>) {
    const sequence = supplierSyncSnapshotSequenceFromRuns(successfulRuns, run.id) ?? 1;
    return {
      id: run.id,
      snapshotRef: formatSupplierSyncSnapshotRef(sequence),
      importedCount: run.importedCount,
      finishedAt: run.finishedAt.toISOString(),
    };
  }

  private async buildLastAssessment(
    organizationId: string,
    syncRunId: string | null,
    assessedAt: Date | null,
    successfulRuns: Array<{ id: string }>,
  ) {
    if (!syncRunId || !assessedAt) {
      return null;
    }

    const run = await this.prisma.supplierSourceSyncRun.findFirst({
      where: {
        id: syncRunId,
        organizationId,
      },
      select: {
        id: true,
        importedCount: true,
        finishedAt: true,
        status: true,
      },
    });

    if (!run || !isSuccessfulSupplierSyncRun(run) || !run.finishedAt) {
      return null;
    }

    const sequence = supplierSyncSnapshotSequenceFromRuns(successfulRuns, run.id) ?? 1;

    return {
      syncRunId: run.id,
      snapshotRef: formatSupplierSyncSnapshotRef(sequence),
      assessedAt: assessedAt.toISOString(),
    };
  }
}
