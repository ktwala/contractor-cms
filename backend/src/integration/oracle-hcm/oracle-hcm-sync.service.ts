import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ContractorSourceSyncRunMode,
  ContractorSourceSyncRunStatus,
  HcmOracleConnectorHealth,
} from '@prisma/client';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { AuditService } from '../../core/audit/audit.service';
import { ContractorSourceSyncRunService } from '../../domain/contractor-sources/contractor-source-sync-run.service';
import { HcmContractorConnectorStagingWriterService } from '../../domain/contractor-sources/hcm-contractor-connector-staging-writer.service';
import type { HcmExtractRecord } from '../../domain/contractor-migration/types/hcm-extract.types';
import { HcmContractorFileExtractParser } from '../../domain/contractor-migration/parsers/hcm-contractor-file-extract.parser';
import { HttpOracleHcmRestClient } from './oracle-hcm-rest.client';
import { OracleHcmHealthService } from './oracle-hcm-health.service';

export type HcmSyncRunResponseDto = {
  syncRunId: string;
  status: ContractorSourceSyncRunStatus;
  mode: ContractorSourceSyncRunMode;
  summary: {
    imported: number;
    matched: number;
    possibleMatch: number;
    new: number;
    conflict: number;
    correlationFailures: number;
    failed: number;
  };
  connectorHealth?: HcmOracleConnectorHealth;
  checkpointTo?: string | null;
};

/**
 * PR-CTR-CONNECTOR-1A–1C / 1D — HCM sync orchestration with REST health semantics.
 * File replay success does not imply Oracle HCM REST is healthy.
 */
@Injectable()
export class OracleHcmSyncService {
  constructor(
    private readonly syncRunService: ContractorSourceSyncRunService,
    private readonly stagingWriter: HcmContractorConnectorStagingWriterService,
    private readonly restClient: HttpOracleHcmRestClient,
    private readonly fileParser: HcmContractorFileExtractParser,
    private readonly healthService: OracleHcmHealthService,
    private readonly auditService: AuditService,
  ) {}

  private resolveOrgId(accessContext: AccessContext): string {
    const orgId = accessContext.targetOrganizationId;
    if (!orgId) {
      throw new BadRequestException('Organization context is required');
    }
    return orgId;
  }

  private isRestSyncMode(mode: ContractorSourceSyncRunMode): boolean {
    return mode === ContractorSourceSyncRunMode.INCREMENTAL;
  }

  async importFromFile(
    accessContext: AccessContext,
    input: { format: 'json' | 'csv'; content: string },
  ): Promise<HcmSyncRunResponseDto> {
    const records =
      input.format === 'csv'
        ? this.fileParser.parseCsv(input.content)
        : this.fileParser.parseJson(input.content);

    return this.executeSyncRun(
      accessContext,
      ContractorSourceSyncRunMode.REPLAY,
      async () => records,
    );
  }

  async syncIncremental(accessContext: AccessContext): Promise<HcmSyncRunResponseDto> {
    const organizationId = this.resolveOrgId(accessContext);

    if (!this.restClient.isEnabled()) {
      const run = await this.syncRunService.startRun({
        organizationId,
        mode: ContractorSourceSyncRunMode.INCREMENTAL,
        requestedByUserId: accessContext.actorUserId,
      });
      await this.healthService.persistConnectorState(
        organizationId,
        HcmOracleConnectorHealth.DISABLED,
        'Oracle HCM REST sync is disabled',
      );
      await this.syncRunService.markFailed(
        run.id,
        organizationId,
        {
          code: 'DISABLED',
          message: 'Oracle HCM REST sync is disabled',
        },
        HcmOracleConnectorHealth.DISABLED,
      );
      throw new BadRequestException(
        'Oracle HCM REST sync is disabled. Use file import or enable HCM_ORACLE_REST_ENABLED.',
      );
    }

    const checkpoint = await this.syncRunService.getOrgCheckpoint(organizationId);

    return this.executeSyncRun(
      accessContext,
      ContractorSourceSyncRunMode.INCREMENTAL,
      async () => {
        const page = await this.restClient.fetchWorkers({
          organizationId,
          since: checkpoint?.oracleHcmLastSuccessfulSyncAt ?? undefined,
          cursor: checkpoint?.oracleHcmLastCursor ?? undefined,
        });
        return {
          records: page.records,
          nextCursor: page.nextCursor,
          checkpointTo: page.checkpointTo,
        };
      },
    );
  }

  private async executeSyncRun(
    accessContext: AccessContext,
    mode: ContractorSourceSyncRunMode,
    load: () => Promise<HcmExtractRecord[] | {
      records: HcmExtractRecord[];
      nextCursor?: string | null;
      checkpointTo?: Date;
    }>,
  ): Promise<HcmSyncRunResponseDto> {
    const organizationId = this.resolveOrgId(accessContext);
    const restSync = this.isRestSyncMode(mode);
    const orgCheckpoint = await this.syncRunService.getOrgCheckpoint(organizationId);

    const run = await this.syncRunService.startRun({
      organizationId,
      mode,
      requestedByUserId: accessContext.actorUserId,
      checkpointFrom: orgCheckpoint?.oracleHcmLastSuccessfulSyncAt ?? null,
    });

    try {
      const loaded = await load();
      const records = Array.isArray(loaded) ? loaded : loaded.records;
      const nextCursor = Array.isArray(loaded) ? null : (loaded.nextCursor ?? null);
      const checkpointTo = Array.isArray(loaded)
        ? new Date()
        : (loaded.checkpointTo ?? new Date());

      const write = await this.stagingWriter.upsertRecords(
        organizationId,
        run.id,
        records,
      );

      const status = this.resolveStatus(write.summary);
      const advance = restSync && this.shouldAdvanceCheckpoint(status);
      const connectorHealth = restSync ? this.healthFromRunStatus(status) : undefined;

      await this.syncRunService.completeRun({
        runId: run.id,
        organizationId,
        status,
        checkpointTo,
        nextCursor,
        importedCount: write.summary.imported,
        matchedCount: write.summary.matched,
        newCount: write.summary.new,
        correlationFailures: write.summary.correlationFailures,
        failedCount: write.summary.failed,
        advanceSuccessfulCheckpoint: advance,
        connectorHealth,
        skipOrgConnectorUpdate: !restSync,
      });

      if (restSync && status === ContractorSourceSyncRunStatus.SUCCEEDED) {
        await this.healthService.recordSuccessfulRestSync(organizationId);
      }

      await this.auditService.logAction(
        accessContext.actorUserId,
        'CONTRACTOR_SOURCE_HCM_IMPORTED',
        'ContractorSourceSyncRun',
        run.id,
        null,
        { ...write.summary, syncRunId: run.id, mode },
        { organizationId },
      );

      const effectiveHealth = (
        await this.healthService.getHealthSnapshot(organizationId)
      ).health;

      return {
        syncRunId: run.id,
        status,
        mode,
        summary: {
          imported: write.summary.imported,
          matched: write.summary.matched,
          possibleMatch: write.summary.possibleMatch,
          new: write.summary.new,
          conflict: write.summary.conflict,
          correlationFailures: write.summary.correlationFailures,
          failed: write.summary.failed,
        },
        connectorHealth: effectiveHealth,
        checkpointTo: restSync ? checkpointTo.toISOString() : null,
      };
    } catch (err) {
      if (restSync) {
        const health = await this.healthService.recordUpstreamFailure(
          organizationId,
          err,
        );
        await this.syncRunService.markFailed(
          run.id,
          organizationId,
          {
            code: health,
            message: err instanceof Error ? err.message : 'Sync failed',
          },
          health,
        );
      } else {
        await this.syncRunService.markFailed(
          run.id,
          organizationId,
          {
            code: 'REPLAY_FAILED',
            message: err instanceof Error ? err.message : 'File import failed',
          },
          HcmOracleConnectorHealth.DEGRADED,
          { skipOrgConnectorUpdate: true },
        );
      }
      throw err;
    }
  }

  private resolveStatus(summary: {
    imported: number;
    failed: number;
  }): ContractorSourceSyncRunStatus {
    if (summary.failed > 0 && summary.imported === 0) {
      return ContractorSourceSyncRunStatus.FAILED;
    }
    if (summary.failed > 0) {
      return ContractorSourceSyncRunStatus.PARTIAL;
    }
    return ContractorSourceSyncRunStatus.SUCCEEDED;
  }

  private shouldAdvanceCheckpoint(status: ContractorSourceSyncRunStatus): boolean {
    return (
      status === ContractorSourceSyncRunStatus.SUCCEEDED ||
      status === ContractorSourceSyncRunStatus.PARTIAL
    );
  }

  private healthFromRunStatus(
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
