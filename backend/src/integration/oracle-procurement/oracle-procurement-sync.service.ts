import { BadRequestException, Injectable } from '@nestjs/common';
import {
  OracleSupplierConnectorHealth,
  SupplierSourceSyncRunMode,
  SupplierSourceSyncRunStatus,
} from '@prisma/client';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { AuditService } from '../../core/audit/audit.service';
import { SupplierSourceSyncRunService } from '../../domain/supplier-sources/supplier-source-sync-run.service';
import { SupplierStagingWriterService } from '../../domain/supplier-sources/supplier-staging-writer.service';
import { SupplierStagingReadService } from '../../domain/supplier-sources/supplier-staging-read.service';
import { OracleSupplierImportDto } from '../../domain/supplier-sources/dto/oracle-supplier-import.dto';
import {
  OracleImportResponseDto,
  OracleStagingRowDto,
} from '../../domain/supplier-sources/dto/oracle-staging-response.dto';
import { computeOracleSupplierRawHash } from './oracle-procurement-hash.util';
import { HttpOracleProcurementRestClient } from './oracle-procurement-rest.client';
import { OracleProcurementHealthService } from './oracle-procurement-health.service';
import { NormalizedOracleSupplierRecord } from './oracle-procurement.types';

export type OracleSyncRunResponseDto = {
  syncRunId: string;
  status: SupplierSourceSyncRunStatus;
  mode: SupplierSourceSyncRunMode;
  summary: OracleImportResponseDto['summary'];
  rows: OracleStagingRowDto[];
  nextCursor?: string | null;
  checkpointTo?: string | null;
  connectorHealth?: OracleSupplierConnectorHealth;
};

/**
 * PR-CMS-CONNECTOR-1A-C / 1D–1E — sync orchestration with health semantics.
 */
@Injectable()
export class OracleProcurementSyncService {
  constructor(
    private readonly syncRunService: SupplierSourceSyncRunService,
    private readonly stagingWriter: SupplierStagingWriterService,
    private readonly stagingRead: SupplierStagingReadService,
    private readonly restClient: HttpOracleProcurementRestClient,
    private readonly healthService: OracleProcurementHealthService,
    private readonly auditService: AuditService,
  ) {}

  private resolveOrgId(accessContext: AccessContext): string {
    const orgId = accessContext.targetOrganizationId;
    if (!orgId) {
      throw new BadRequestException('Organization context is required');
    }
    return orgId;
  }

  fromMockImportDto(dto: OracleSupplierImportDto): NormalizedOracleSupplierRecord[] {
    return dto.suppliers.map((s) => {
      const payload = { ...s } as Record<string, unknown>;
      return {
        sourceSystem: 'ORACLE_SUPPLIER_SAAS' as const,
        externalSupplierId: s.externalSupplierId.trim(),
        supplierNumber: s.supplierNumber ?? null,
        legalName: s.name.trim(),
        tradingName: s.name.trim(),
        taxNumber: s.taxRegistrationNumber ?? null,
        countryCode: s.countryCode.trim().toUpperCase(),
        rawHash: computeOracleSupplierRawHash(payload),
        rawPayloadRef: null,
        sourceUpdatedAt: new Date(),
      };
    });
  }

  async importFromPayload(
    accessContext: AccessContext,
    dto: OracleSupplierImportDto,
    mode: SupplierSourceSyncRunMode = SupplierSourceSyncRunMode.REPLAY,
  ): Promise<OracleSyncRunResponseDto> {
    return this.executeSyncRun(accessContext, mode, async () =>
      this.fromMockImportDto(dto),
    'ORACLE_SUPPLIER_SAAS_MOCK');
  }

  async syncIncremental(
    accessContext: AccessContext,
  ): Promise<OracleSyncRunResponseDto> {
    const organizationId = this.resolveOrgId(accessContext);

    if (!this.restClient.isEnabled()) {
      const run = await this.syncRunService.startRun({
        organizationId,
        mode: SupplierSourceSyncRunMode.INCREMENTAL,
        requestedByUserId: accessContext.actorUserId,
      });
      await this.syncRunService.markFailed(
        run.id,
        organizationId,
        {
          code: 'DISABLED',
          message: 'Oracle Procurement REST is disabled',
        },
        OracleSupplierConnectorHealth.DISABLED,
      );
      throw new BadRequestException(
        'Oracle Procurement REST sync is disabled. Use mock import or enable ORACLE_PROCUREMENT_REST_ENABLED.',
      );
    }

    const checkpoint = await this.syncRunService.getOrgCheckpoint(organizationId);

    return this.executeSyncRun(
      accessContext,
      SupplierSourceSyncRunMode.INCREMENTAL,
      async () => {
        const page = await this.restClient.fetchSuppliers({
          organizationId,
          since: checkpoint?.oracleSupplierLastSuccessfulSyncAt ?? undefined,
          cursor: checkpoint?.oracleSupplierLastCursor ?? undefined,
        });
        return {
          records: page.records,
          nextCursor: page.nextCursor ?? null,
          checkpointTo: page.checkpointTo,
        };
      },
      'ORACLE_PROCUREMENT_REST',
    );
  }

  private async executeSyncRun(
    accessContext: AccessContext,
    mode: SupplierSourceSyncRunMode,
    load:
      | (() => Promise<NormalizedOracleSupplierRecord[]>)
      | (() => Promise<{
          records: NormalizedOracleSupplierRecord[];
          nextCursor?: string | null;
          checkpointTo?: Date;
        }>),
    sourceLabel: string,
  ): Promise<OracleSyncRunResponseDto> {
    const organizationId = this.resolveOrgId(accessContext);
    const orgCheckpoint = await this.syncRunService.getOrgCheckpoint(organizationId);

    const run = await this.syncRunService.startRun({
      organizationId,
      mode,
      requestedByUserId: accessContext.actorUserId,
      checkpointFrom: orgCheckpoint?.oracleSupplierLastSuccessfulSyncAt ?? null,
    });

    try {
      const loaded = await load();
      const records = Array.isArray(loaded) ? loaded : loaded.records;
      const nextCursor = Array.isArray(loaded) ? null : (loaded.nextCursor ?? null);
      const checkpointTo = Array.isArray(loaded)
        ? new Date()
        : (loaded.checkpointTo ?? new Date());

      const write = await this.stagingWriter.upsertRecords(organizationId, records, {
        sourceLabel,
      });

      const status = this.resolveStatus(write.summary);
      const advance = this.shouldAdvanceCheckpoint(status);
      const connectorHealth = this.healthFromRunStatus(status);

      await this.syncRunService.completeRun({
        runId: run.id,
        organizationId,
        status,
        checkpointTo,
        nextCursor,
        importedCount: write.summary.imported,
        matchedCount: write.summary.matched,
        newCount: write.summary.new,
        failedCount: write.summary.failed,
        advanceSuccessfulCheckpoint: advance,
        connectorHealth,
      });

      if (status === SupplierSourceSyncRunStatus.SUCCEEDED) {
        await this.healthService.recordSuccessfulSync(organizationId);
      }

      const rows = await this.stagingRead.listStagingRowsByIds(
        accessContext,
        write.stagingIds,
      );

      await this.auditService.logAction(
        accessContext.actorUserId,
        'SUPPLIER_SOURCE_ORACLE_IMPORTED',
        'SupplierSourceSyncRun',
        run.id,
        null,
        { ...write.summary, syncRunId: run.id, mode, connectorHealth },
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
        },
        rows,
        nextCursor,
        checkpointTo: checkpointTo.toISOString(),
        connectorHealth: effectiveHealth,
      };
    } catch (err) {
      const health = await this.healthService.recordUpstreamFailure(
        organizationId,
        err,
      );
      await this.syncRunService.markFailed(run.id, organizationId, {
        code: health,
        message: err instanceof Error ? err.message : 'Sync failed',
      }, health);
      throw err;
    }
  }

  private resolveStatus(summary: {
    imported: number;
    failed: number;
  }): SupplierSourceSyncRunStatus {
    if (summary.failed > 0 && summary.imported === 0) {
      return SupplierSourceSyncRunStatus.FAILED;
    }
    if (summary.failed > 0) {
      return SupplierSourceSyncRunStatus.PARTIAL;
    }
    return SupplierSourceSyncRunStatus.SUCCEEDED;
  }

  private shouldAdvanceCheckpoint(status: SupplierSourceSyncRunStatus): boolean {
    return (
      status === SupplierSourceSyncRunStatus.SUCCEEDED ||
      status === SupplierSourceSyncRunStatus.PARTIAL
    );
  }

  private healthFromRunStatus(
    status: SupplierSourceSyncRunStatus,
  ): OracleSupplierConnectorHealth {
    switch (status) {
      case SupplierSourceSyncRunStatus.SUCCEEDED:
        return OracleSupplierConnectorHealth.HEALTHY;
      case SupplierSourceSyncRunStatus.PARTIAL:
        return OracleSupplierConnectorHealth.DEGRADED;
      default:
        return OracleSupplierConnectorHealth.DEGRADED;
    }
  }
}
