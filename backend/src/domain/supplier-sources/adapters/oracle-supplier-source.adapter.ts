import { Injectable } from '@nestjs/common';
import { SupplierSourceSyncRunMode } from '@prisma/client';
import { AccessContext } from '../../../core/auth/interfaces/access-context.interface';
import {
  NormalizedGovernanceTwinBatchResult,
  NormalizedGovernanceTwinPromotionResult,
  NormalizedSupplierImportRequest,
  NormalizedSupplierImportResult,
  NormalizedSupplierStagingListQuery,
  NormalizedSupplierStagingListResult,
} from '../../../integration/contracts/normalized-supplier-source.dto';
import {
  ORACLE_PROCUREMENT_ADAPTER_ID,
  SupplierSourceAdapter,
} from '../../../integration/contracts/supplier-source.adapter';
import { OracleProcurementSyncService } from '../../../integration/oracle-procurement/oracle-procurement-sync.service';
import { OracleSupplierImportDto } from '../dto/oracle-supplier-import.dto';
import { QueryOracleStagingDto } from '../dto/query-oracle-staging.dto';
import { OracleSupplierImportService } from '../oracle-supplier-import.service';
import { SupplierGovernanceTwinPromotionService } from '../supplier-governance-twin-promotion.service';

/**
 * PR-CMS-INT-3 / CONNECTOR-1 — Oracle Procurement → staging via sync run ledger.
 */
@Injectable()
export class OracleSupplierSourceAdapter implements SupplierSourceAdapter {
  readonly sourceSystemId = ORACLE_PROCUREMENT_ADAPTER_ID;

  constructor(
    private readonly oracleSync: OracleProcurementSyncService,
    private readonly oracleImport: OracleSupplierImportService,
    private readonly governanceTwinPromotion: SupplierGovernanceTwinPromotionService,
  ) {}

  private toOraclePayload(
    request: NormalizedSupplierImportRequest,
  ): OracleSupplierImportDto {
    return {
      suppliers: request.records.map((r) => ({
        externalSupplierId: r.externalSupplierId,
        supplierNumber: r.supplierNumber ?? undefined,
        name: r.name,
        countryCode: r.countryCode,
        taxRegistrationNumber: r.taxRegistrationNumber ?? undefined,
        metadata: r.metadata,
      })),
    };
  }

  async importSuppliers(
    accessContext: AccessContext,
    request: NormalizedSupplierImportRequest,
  ): Promise<NormalizedSupplierImportResult> {
    const result = await this.oracleSync.importFromPayload(
      accessContext,
      this.toOraclePayload(request),
      SupplierSourceSyncRunMode.REPLAY,
    );
    return {
      summary: result.summary,
      rows: result.rows,
      syncRunId: result.syncRunId,
      syncRunStatus: result.status,
    };
  }

  async listStaging(
    accessContext: AccessContext,
    query: NormalizedSupplierStagingListQuery,
  ): Promise<NormalizedSupplierStagingListResult> {
    const oracleQuery: QueryOracleStagingDto = {
      matchStatus: query.matchStatus,
      page: query.page,
      limit: query.limit,
    };
    return this.oracleImport.listStaging(
      accessContext,
      oracleQuery,
    ) as Promise<NormalizedSupplierStagingListResult>;
  }

  async promoteStagingRow(
    accessContext: AccessContext,
    stagingId: string,
  ): Promise<NormalizedGovernanceTwinPromotionResult> {
    return this.governanceTwinPromotion.promoteStagingRow(
      accessContext,
      stagingId,
    ) as Promise<NormalizedGovernanceTwinPromotionResult>;
  }

  async promoteStagingBatch(
    accessContext: AccessContext,
    stagingIds?: string[],
  ): Promise<NormalizedGovernanceTwinBatchResult> {
    return this.governanceTwinPromotion.promoteStagingBatch(
      accessContext,
      stagingIds,
    ) as Promise<NormalizedGovernanceTwinBatchResult>;
  }
}
