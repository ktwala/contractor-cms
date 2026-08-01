import { Injectable } from '@nestjs/common';
import {
  ContractorSourceSyncRunStatus,
} from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import {
  WorkforceAssessmentLifecyclePhase,
  WorkforceAssessmentStatusDto,
} from './dto/workforce-assessment-status.dto';
import {
  WorkforceDiscoverySnapshotHistoryItemDto,
  WorkforceSnapshotAssessmentLabel,
} from './dto/workforce-discovery-snapshot-history.dto';
import {
  discoverySnapshotSequenceFromRuns,
  formatDiscoverySnapshotRef,
  isSuccessfulDiscoveryRun,
} from './workforce-discovery-snapshot.util';

type DiscoveryRunRow = {
  id: string;
  importedCount: number;
  finishedAt: Date;
};

@Injectable()
export class WorkforceAssessmentService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveStatus(organizationId: string): Promise<WorkforceAssessmentStatusDto> {
    const [org, latestRun, successfulRuns] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          workforceLastAssessedDiscoveryRunId: true,
          workforceLastAssessedAt: true,
        },
      }),
      this.prisma.contractorSourceSyncRun.findFirst({
        where: {
          organizationId,
          status: ContractorSourceSyncRunStatus.SUCCEEDED,
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

    const latestDiscoveryRun = latestRun?.finishedAt
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
      org?.workforceLastAssessedDiscoveryRunId ?? null,
      org?.workforceLastAssessedAt ?? null,
      successfulRuns,
    );

    let lifecyclePhase: WorkforceAssessmentLifecyclePhase;
    if (!latestDiscoveryRun) {
      lifecyclePhase = 'DISCOVERY_PENDING';
    } else if (
      !org?.workforceLastAssessedDiscoveryRunId ||
      org.workforceLastAssessedDiscoveryRunId !== latestDiscoveryRun.id
    ) {
      lifecyclePhase = 'ASSESSMENT_PENDING';
    } else {
      lifecyclePhase = 'ASSESSMENT_CURRENT';
    }

    const canRunAssessment = lifecyclePhase === 'ASSESSMENT_PENDING';

    return {
      lifecyclePhase,
      canRunAssessment,
      latestDiscoveryRun,
      lastAssessment,
      findingsSnapshotRef: lastAssessment?.snapshotRef ?? null,
    };
  }

  async recordCompletion(
    organizationId: string,
    discoveryRunId: string,
  ): Promise<void> {
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        workforceLastAssessedDiscoveryRunId: discoveryRunId,
        workforceLastAssessedAt: new Date(),
      },
    });
  }

  async getLatestSuccessfulDiscoveryRunId(
    organizationId: string,
  ): Promise<string | null> {
    const run = await this.prisma.contractorSourceSyncRun.findFirst({
      where: {
        organizationId,
        status: ContractorSourceSyncRunStatus.SUCCEEDED,
        finishedAt: { not: null },
      },
      orderBy: { finishedAt: 'desc' },
      select: { id: true },
    });
    return run?.id ?? null;
  }

  async listSnapshotHistory(
    organizationId: string,
    limit = 20,
  ): Promise<WorkforceDiscoverySnapshotHistoryItemDto[]> {
    const [org, successfulRuns, runs] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { workforceLastAssessedDiscoveryRunId: true },
      }),
      this.loadSuccessfulRunSequence(organizationId),
      this.prisma.contractorSourceSyncRun.findMany({
        where: {
          organizationId,
          status: ContractorSourceSyncRunStatus.SUCCEEDED,
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
          correlationFailures: true,
        },
      }),
    ]);

    const latestRunId = runs[0]?.id ?? null;
    const assessedRunId = org?.workforceLastAssessedDiscoveryRunId ?? null;

    return runs.map((run) => {
      const sequence = discoverySnapshotSequenceFromRuns(successfulRuns, run.id) ?? 1;
      const unchangedWorkers = Math.max(
        0,
        run.importedCount - run.newCount - run.matchedCount - run.failedCount,
      );

      let assessmentLabel: WorkforceSnapshotAssessmentLabel;
      if (run.id === assessedRunId) {
        assessmentLabel = 'Assessed';
      } else if (run.id === latestRunId) {
        assessmentLabel = 'Pending';
      } else {
        assessmentLabel = 'Not assessed';
      }

      return {
        id: run.id,
        snapshotRef: formatDiscoverySnapshotRef(sequence),
        createdAt: run.finishedAt!.toISOString(),
        source: 'Oracle HCM',
        status: run.status,
        workersDiscovered: run.importedCount,
        newWorkers: run.newCount,
        updatedWorkers: run.matchedCount,
        unchangedWorkers,
        failedWorkers: run.failedCount,
        discoveryExceptions: run.correlationFailures,
        assessmentLabel,
        isLatest: run.id === latestRunId,
      };
    });
  }

  private async loadSuccessfulRunSequence(organizationId: string) {
    return this.prisma.contractorSourceSyncRun.findMany({
      where: {
        organizationId,
        status: ContractorSourceSyncRunStatus.SUCCEEDED,
        finishedAt: { not: null },
      },
      orderBy: { finishedAt: 'asc' },
      select: { id: true },
    });
  }

  private toSnapshotDto(
    run: DiscoveryRunRow,
    successfulRuns: Array<{ id: string }>,
  ) {
    const sequence = discoverySnapshotSequenceFromRuns(successfulRuns, run.id) ?? 1;
    return {
      id: run.id,
      snapshotRef: formatDiscoverySnapshotRef(sequence),
      importedCount: run.importedCount,
      finishedAt: run.finishedAt.toISOString(),
    };
  }

  private async buildLastAssessment(
    organizationId: string,
    discoveryRunId: string | null,
    assessedAt: Date | null,
    successfulRuns: Array<{ id: string }>,
  ) {
    if (!discoveryRunId || !assessedAt) {
      return null;
    }

    const run = await this.prisma.contractorSourceSyncRun.findFirst({
      where: {
        id: discoveryRunId,
        organizationId,
      },
      select: {
        id: true,
        importedCount: true,
        finishedAt: true,
        status: true,
      },
    });

    if (!run || !isSuccessfulDiscoveryRun(run) || !run.finishedAt) {
      return null;
    }

    const sequence =
      discoverySnapshotSequenceFromRuns(successfulRuns, run.id) ?? 1;

    return {
      discoveryRunId: run.id,
      snapshotRef: formatDiscoverySnapshotRef(sequence),
      assessedAt: assessedAt.toISOString(),
    };
  }
}
