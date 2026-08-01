import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { SOURCE_SYSTEM_IDS, SourceSystemId } from './source-system.codes';
import {
  NormalizedGovernanceTwinBatchResult,
  NormalizedGovernanceTwinPromotionResult,
  NormalizedSupplierImportRequest,
  NormalizedSupplierImportResult,
  NormalizedSupplierStagingListQuery,
  NormalizedSupplierStagingListResult,
} from './normalized-supplier-source.dto';

/**
 * PR-CMS-INT-3 — supplier upstream integration boundary.
 * Adapters land in staging; governance promotion remains CMS-owned.
 */
export interface SupplierSourceAdapter {
  readonly sourceSystemId: SourceSystemId;

  importSuppliers(
    accessContext: AccessContext,
    request: NormalizedSupplierImportRequest,
  ): Promise<NormalizedSupplierImportResult>;

  listStaging(
    accessContext: AccessContext,
    query: NormalizedSupplierStagingListQuery,
  ): Promise<NormalizedSupplierStagingListResult>;

  promoteStagingRow(
    accessContext: AccessContext,
    stagingId: string,
  ): Promise<NormalizedGovernanceTwinPromotionResult>;

  promoteStagingBatch(
    accessContext: AccessContext,
    stagingIds?: string[],
  ): Promise<NormalizedGovernanceTwinBatchResult>;
}

export const ORACLE_PROCUREMENT_ADAPTER_ID = SOURCE_SYSTEM_IDS.ORACLE_PROCUREMENT;
