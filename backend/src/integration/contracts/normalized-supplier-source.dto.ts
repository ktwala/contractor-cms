import {
  SupplierSourceStagingMatchStatus,
  SupplierSourceSyncRunStatus,
  SupplierSourceSystem,
  SupplierStatus,
} from '@prisma/client';

/** CMS-normalized supplier extract row (upstream-agnostic). */
export type NormalizedSupplierRecord = {
  externalSupplierId: string;
  supplierNumber?: string | null;
  name: string;
  countryCode: string;
  taxRegistrationNumber?: string | null;
  metadata?: Record<string, unknown>;
};

export type NormalizedSupplierImportRequest = {
  records: NormalizedSupplierRecord[];
};

export type NormalizedSupplierStagingRow = {
  id: string;
  externalSupplierId: string;
  supplierNumber: string | null;
  name: string;
  countryCode: string;
  taxRegistrationNumber: string | null;
  matchStatus: SupplierSourceStagingMatchStatus;
  matchReason: string | null;
  proposedSupplierId: string | null;
  matchedSupplier: {
    id: string;
    displayName: string;
    status: string;
    jurisdictionCode: string;
  } | null;
  importedAt: string;
  updatedAt: string;
};

export type NormalizedSupplierImportResult = {
  summary: {
    imported: number;
    matched: number;
    possibleMatch: number;
    new: number;
    conflict: number;
  };
  rows: NormalizedSupplierStagingRow[];
  /** PR-CMS-CONNECTOR-1B — present when import runs through sync ledger */
  syncRunId?: string;
  syncRunStatus?: SupplierSourceSyncRunStatus;
};

export type NormalizedSupplierStagingListQuery = {
  matchStatus?: SupplierSourceStagingMatchStatus;
  page?: number;
  limit?: number;
};

export type NormalizedSupplierStagingListResult = {
  data: NormalizedSupplierStagingRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type NormalizedGovernanceTwinPromotionResult = {
  stagingId: string;
  outcome: 'CREATED' | 'LINKED';
  supplierId: string;
  status: SupplierStatus;
  externalSupplierId: string;
  sourceSystem: SupplierSourceSystem;
  idempotent?: boolean;
};

export type NormalizedGovernanceTwinBatchResult = {
  promoted: number;
  failed: number;
  results: NormalizedGovernanceTwinPromotionResult[];
  errors: Array<{ stagingId: string; message: string; code?: string }>;
};
