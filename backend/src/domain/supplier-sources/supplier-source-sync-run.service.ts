import { BadRequestException, Injectable } from '@nestjs/common';
import {
  OracleSupplierConnectorHealth,
  Prisma,
  SupplierSourceSyncRunMode,
  SupplierSourceSyncRunStatus,
  SupplierSourceSystem,
} from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import {
  OracleSyncRunListItemDto,
  PaginatedOracleSyncRunsResponseDto,
} from './dto/oracle-connector-anomalies.dto';

export type StartSyncRunInput = {
  organizationId: string;
  mode: SupplierSourceSyncRunMode;
  requestedByUserId?: string | null;
  checkpointFrom?: Date | null;
};

export type CompleteSyncRunInput = {
  runId: string;
  organizationId: string;
  status: SupplierSourceSyncRunStatus;
  checkpointTo?: Date | null;
  nextCursor?: string | null;
  importedCount: number;
  matchedCount: number;
  newCount: number;
  failedCount: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  advanceSuccessfulCheckpoint: boolean;
  connectorHealth?: OracleSupplierConnectorHealth;
};

@Injectable()
export class SupplierSourceSyncRunService {
  constructor(private readonly prisma: PrismaService) {}

  startRun(input: StartSyncRunInput) {
    return this.prisma.supplierSourceSyncRun.create({
      data: {
        organizationId: input.organizationId,
        sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
        status: SupplierSourceSyncRunStatus.RUNNING,
        mode: input.mode,
        requestedByUserId: input.requestedByUserId ?? null,
        checkpointFrom: input.checkpointFrom ?? null,
      },
    });
  }

  async completeRun(input: CompleteSyncRunInput) {
    const finishedAt = new Date();

    const run = await this.prisma.supplierSourceSyncRun.update({
      where: { id: input.runId },
      data: {
        status: input.status,
        finishedAt,
        checkpointTo: input.checkpointTo ?? null,
        nextCursor: input.nextCursor ?? null,
        importedCount: input.importedCount,
        matchedCount: input.matchedCount,
        newCount: input.newCount,
        failedCount: input.failedCount,
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null,
      },
    });

    const orgUpdate: Prisma.OrganizationUpdateInput = {
      oracleSupplierConnectorHealth:
        input.connectorHealth ?? this.healthFromStatus(input.status),
      oracleSupplierConnectorLastError:
        input.status === SupplierSourceSyncRunStatus.SUCCEEDED
          ? null
          : (input.errorMessage ?? null),
    };

    if (input.advanceSuccessfulCheckpoint) {
      orgUpdate.oracleSupplierLastSuccessfulSyncAt =
        input.checkpointTo ?? finishedAt;
      if (input.nextCursor !== undefined) {
        orgUpdate.oracleSupplierLastCursor = input.nextCursor;
      }
    }

    await this.prisma.organization.update({
      where: { id: input.organizationId },
      data: orgUpdate,
    });

    return run;
  }

  async markFailed(
    runId: string,
    organizationId: string,
    error: { code?: string; message: string },
    connectorHealth: OracleSupplierConnectorHealth = OracleSupplierConnectorHealth.DEGRADED,
  ) {
    return this.completeRun({
      runId,
      organizationId,
      status: SupplierSourceSyncRunStatus.FAILED,
      importedCount: 0,
      matchedCount: 0,
      newCount: 0,
      failedCount: 0,
      errorCode: error.code ?? 'SYNC_FAILED',
      errorMessage: error.message,
      advanceSuccessfulCheckpoint: false,
      connectorHealth,
    });
  }

  getOrgCheckpoint(organizationId: string) {
    return this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        oracleSupplierLastSuccessfulSyncAt: true,
        oracleSupplierLastCursor: true,
        oracleSupplierConnectorHealth: true,
      },
    });
  }

  async listRuns(
    accessContext: AccessContext,
    query: {
      status?: SupplierSourceSyncRunStatus;
      mode?: SupplierSourceSyncRunMode;
      page?: number;
      limit?: number;
    },
  ): Promise<PaginatedOracleSyncRunsResponseDto> {
    const organizationId = accessContext.targetOrganizationId;
    if (!organizationId) {
      throw new BadRequestException('Organization context is required');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.SupplierSourceSyncRunWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.mode ? { mode: query.mode } : {}),
    };

    const [runs, total] = await Promise.all([
      this.prisma.supplierSourceSyncRun.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.supplierSourceSyncRun.count({ where }),
    ]);

    return {
      data: runs.map((run) => this.toListItem(run)),
      total,
      page,
      limit,
    };
  }

  private toListItem(run: {
    id: string;
    status: SupplierSourceSyncRunStatus;
    mode: SupplierSourceSyncRunMode;
    startedAt: Date;
    finishedAt: Date | null;
    importedCount: number;
    matchedCount: number;
    newCount: number;
    failedCount: number;
    errorCode: string | null;
    errorMessage: string | null;
    checkpointFrom: Date | null;
    checkpointTo: Date | null;
    nextCursor: string | null;
  }): OracleSyncRunListItemDto {
    const durationMs =
      run.finishedAt != null
        ? run.finishedAt.getTime() - run.startedAt.getTime()
        : null;

    return {
      id: run.id,
      status: run.status,
      mode: run.mode,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      durationMs,
      importedCount: run.importedCount,
      matchedCount: run.matchedCount,
      newCount: run.newCount,
      failedCount: run.failedCount,
      errorCode: run.errorCode,
      errorMessage: run.errorMessage,
      checkpointFrom: run.checkpointFrom?.toISOString() ?? null,
      checkpointTo: run.checkpointTo?.toISOString() ?? null,
      nextCursor: run.nextCursor,
    };
  }

  private healthFromStatus(
    status: SupplierSourceSyncRunStatus,
  ): OracleSupplierConnectorHealth {
    switch (status) {
      case SupplierSourceSyncRunStatus.SUCCEEDED:
        return OracleSupplierConnectorHealth.HEALTHY;
      case SupplierSourceSyncRunStatus.PARTIAL:
        return OracleSupplierConnectorHealth.DEGRADED;
      case SupplierSourceSyncRunStatus.FAILED:
        return OracleSupplierConnectorHealth.DEGRADED;
      default:
        return OracleSupplierConnectorHealth.UNKNOWN;
    }
  }
}
