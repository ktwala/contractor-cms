import { SUPPLIER_SOURCE_SYSTEMS } from '../../domain/suppliers/supplier-source.constants';
import { computeOracleSupplierRawHash } from './oracle-procurement-hash.util';
import { NormalizedOracleSupplierRecord } from './oracle-procurement.types';

/** Extract supplier items from Oracle FCM/Procurement list response shapes. */
export function extractOracleProcurementItems(body: unknown): unknown[] {
  if (!body || typeof body !== 'object') {
    return [];
  }
  const obj = body as Record<string, unknown>;
  if (Array.isArray(obj.items)) {
    return obj.items;
  }
  if (Array.isArray(obj.Suppliers)) {
    return obj.Suppliers;
  }
  const nested = obj.items as { items?: unknown[] } | undefined;
  if (nested && Array.isArray(nested.items)) {
    return nested.items;
  }
  return [];
}

export function mapOracleProcurementItem(
  item: unknown,
  index: number,
): NormalizedOracleSupplierRecord | null {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const row = item as Record<string, unknown>;

  const externalSupplierId = stringField(
    row.SupplierId ?? row.supplierId ?? row.VendorId ?? row.vendorId,
  );
  if (!externalSupplierId) {
    return null;
  }

  const legalName =
    stringField(row.Supplier ?? row.supplier ?? row.SupplierName ?? row.supplierName) ??
    `Oracle Supplier ${index + 1}`;

  const countryCode =
    stringField(row.CountryCode ?? row.countryCode ?? row.Country ?? row.country)?.toUpperCase() ??
    'ZA';

  const payload = row as Record<string, unknown>;

  return {
    sourceSystem: SUPPLIER_SOURCE_SYSTEMS.ORACLE_SUPPLIER_SAAS,
    externalSupplierId,
    supplierNumber: stringField(row.SupplierNumber ?? row.supplierNumber),
    legalName,
    tradingName: stringField(row.TradingName ?? row.tradingName) ?? legalName,
    registrationNumber: stringField(
      row.RegistrationNumber ?? row.registrationNumber,
    ),
    taxNumber: stringField(
      row.TaxRegistrationNumber ??
        row.taxRegistrationNumber ??
        row.TaxPayerId ??
        row.taxPayerId,
    ),
    email: stringField(row.Email ?? row.email),
    phone: stringField(row.Phone ?? row.phone ?? row.PhoneNumber),
    countryCode: countryCode.length === 2 ? countryCode : 'ZA',
    rawHash: computeOracleSupplierRawHash(payload),
    rawPayloadRef: null,
    sourceUpdatedAt: parseDate(
      row.LastUpdateDate ?? row.lastUpdateDate ?? row.LastUpdatedAt,
    ),
  };
}

export function mapOracleProcurementItems(body: unknown): NormalizedOracleSupplierRecord[] {
  return extractOracleProcurementItems(body)
    .map((item, index) => mapOracleProcurementItem(item, index))
    .filter((r): r is NormalizedOracleSupplierRecord => r != null);
}

function stringField(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

function parseDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}
