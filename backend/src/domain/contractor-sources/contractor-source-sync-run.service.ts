import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ContractorSourceSyncRunMode,
  ContractorSourceSyncRunStatus,
  HcmOracleConnectorHealth,
  MigrationSourceSystem,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';

export type StartContractorSyncRunInput = {
  organizationId: string;
  mode: ContractorSourceSyncRunMode;
  requestedByUserId?: string | null;
  checkpointFrom?: Date | null;
};

export type CompleteContractorSyncRunInput = {
  runId: string;
  organizationId: string;
  status: ContractorSourceSyncRunStatus;
  checkpointTo?: Date | null;
  nextCursor?: string | null;
  importedCount: number;
  matchedCount: number;
  newCount: number;
  correlationFailures: number;
  failedCount: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  advanceSuccessfulCheckpoint: boolean;
  connectorHealth?: HcmOracleConnectorHealth;
  /** When true, only the sync-run row is updated — REST connector org state is untouched (file replay). */
  skipOrgConnectorUpdate?: boolean;
};

@Injectable()
export class ContractorSourceSyncRunService {
  constructor(private readonly prisma: PrismaService) {}

  startRun(input: StartContractorSyncRunInput) {
    return this.prisma.contractorSourceSyncRun.create({
      data: {
        organizationId: input.organizationId,
        sourceSystem: MigrationSourceSystem.ORACLE_HCM,
        status: ContractorSourceSyncRunStatus.RUNNING,
        mode: input.mode,
        requestedByUserId: input.requestedByUserId ?? null,
        checkpointFrom: input.checkpointFrom ?? null,
      },
    });
  }

  async completeRun(input: CompleteContractorSyncRunInput) {
    const finishedAt = new Date();

    const run = await this.prisma.contractorSourceSyncRun.update({
      where: { id: input.runId },
      data: {
        status: input.status,
        finishedAt,
        checkpointTo: input.checkpointTo ?? null,
        nextCursor: input.nextCursor ?? null,
        importedCount: input.importedCount,
        matchedCount: input.matchedCount,
        newCount: input.newCount,
        correlationFailures: input.correlationFailures,
        failedCount: input.failedCount,
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null,
      },
    });

    if (!input.skipOrgConnectorUpdate) {
      const orgUpdate: Prisma.OrganizationUpdateInput = {
        oracleHcmConnectorHealth:
          input.connectorHealth ?? this.healthFromStatus(input.status),
        oracleHcmConnectorLastError:
          input.status === ContractorSourceSyncRunStatus.SUCCEEDED
            ? null
            : (input.errorMessage ?? null),
      };

      if (input.advanceSuccessfulCheckpoint) {
        orgUpdate.oracleHcmLastSuccessfulSyncAt = input.checkpointTo ?? finishedAt;
        if (input.nextCursor !== undefined) {
          orgUpdate.oracleHcmLastCursor = input.nextCursor;
        }
      }

      await this.prisma.organization.update({
        where: { id: input.organizationId },
        data: orgUpdate,
      });
    }

    return run;
  }

  async markFailed(
    runId: string,
    organizationId: string,
    error: { code?: string; message: string },
    connectorHealth: HcmOracleConnectorHealth = HcmOracleConnectorHealth.DEGRADED,
    options?: { skipOrgConnectorUpdate?: boolean },
  ) {
    return this.completeRun({
      runId,
      organizationId,
      status: ContractorSourceSyncRunStatus.FAILED,
      importedCount: 0,
      matchedCount: 0,
      newCount: 0,
      correlationFailures: 0,
      failedCount: 0,
      errorCode: error.code ?? 'SYNC_FAILED',
      errorMessage: error.message,
      advanceSuccessfulCheckpoint: false,
      connectorHealth,
      skipOrgConnectorUpdate: options?.skipOrgConnectorUpdate,
    });
  }

  getOrgCheckpoint(organizationId: string) {
    return this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        oracleHcmLastSuccessfulSyncAt: true,
        oracleHcmLastCursor: true,
        oracleHcmConnectorHealth: true,
      },
    });
  }

  async listRuns(
    accessContext: AccessContext,
    query: {
      status?: ContractorSourceSyncRunStatus;
      mode?: ContractorSourceSyncRunMode;
      page?: number;
      limit?: number;
    },
  ) {
    const organizationId = accessContext.targetOrganizationId;
    if (!organizationId) {
      throw new BadRequestException('Organization context is required');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ContractorSourceSyncRunWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.mode ? { mode: query.mode } : {}),
    };

    const [runs, total] = await Promise.all([
      this.prisma.contractorSourceSyncRun.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.contractorSourceSyncRun.count({ where }),
    ]);

    return {
      data: runs.map((run) => ({
        id: run.id,
        status: run.status,
        mode: run.mode,
        startedAt: run.startedAt.toISOString(),
        finishedAt: run.finishedAt?.toISOString() ?? null,
        durationMs:
          run.finishedAt != null
            ? run.finishedAt.getTime() - run.startedAt.getTime()
            : null,
        importedCount: run.importedCount,
        matchedCount: run.matchedCount,
        newCount: run.newCount,
        correlationFailures: run.correlationFailures,
        failedCount: run.failedCount,
        errorCode: run.errorCode,
        errorMessage: run.errorMessage,
        checkpointFrom: run.checkpointFrom?.toISOString() ?? null,
        checkpointTo: run.checkpointTo?.toISOString() ?? null,
        nextCursor: run.nextCursor,
      })),
      total,
      page,
      limit,
    };
  }

  private healthFromStatus(
    status: ContractorSourceSyncRunStatus,
  ): HcmOracleConnectorHealth {
    switch (status) {
      case ContractorSourceSyncRunStatus.SUCCEEDED:
        return HcmOracleConnectorHealth.HEALTHY;
      case ContractorSourceSyncRunStatus.PARTIAL:
        return HcmOracleConnectorHealth.DEGRADED;
      default:
        return HcmOracleConnectorHealth.DEGRADED;
    }
  }
}
