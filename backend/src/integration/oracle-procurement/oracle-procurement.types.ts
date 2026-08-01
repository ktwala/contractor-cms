import { SUPPLIER_SOURCE_SYSTEMS } from '../../domain/suppliers/supplier-source.constants';

/** PR-CMS-CONNECTOR-1A — canonical normalized supplier from Oracle Procurement. */
export type NormalizedOracleSupplierRecord = {
  sourceSystem: typeof SUPPLIER_SOURCE_SYSTEMS.ORACLE_SUPPLIER_SAAS;
  externalSupplierId: string;
  supplierNumber?: string | null;
  legalName: string;
  tradingName?: string | null;
  registrationNumber?: string | null;
  taxNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  countryCode: string;
  rawHash: string;
  rawPayloadRef?: string | null;
  sourceUpdatedAt?: Date | null;
};

export type OracleProcurementFetchInput = {
  organizationId: string;
  since?: Date;
  cursor?: string | null;
  pageSize?: number;
};

export type OracleProcurementFetchResult = {
  records: NormalizedOracleSupplierRecord[];
  nextCursor?: string | null;
  hasMore: boolean;
  checkpointTo: Date;
};

export type OracleProcurementTestConnectionInput = {
  organizationId: string;
};

export type OracleProcurementTestConnectionResult = {
  ok: boolean;
  statusCode?: number;
  errorCode?: string;
  message?: string;
};

export const ORACLE_PROCUREMENT_REST_CLIENT = Symbol(
  'ORACLE_PROCUREMENT_REST_CLIENT',
);
