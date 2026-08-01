/** PR-CMS-OPERATIONS-1D0 — supplier jurisdiction (ISO 3166-1 alpha-2). */
export const SUPPORTED_SUPPLIER_JURISDICTIONS = ['ZA', 'LS'] as const;

export type SupplierJurisdictionCode =
  (typeof SUPPORTED_SUPPLIER_JURISDICTIONS)[number];

export const UNSUPPORTED_SUPPLIER_JURISDICTION = 'UNSUPPORTED_SUPPLIER_JURISDICTION';

export function normalizeSupplierJurisdictionCode(
  value?: string | null,
): SupplierJurisdictionCode | null {
  if (!value?.trim()) return null;
  const code = value.trim().toUpperCase();
  if ((SUPPORTED_SUPPLIER_JURISDICTIONS as readonly string[]).includes(code)) {
    return code as SupplierJurisdictionCode;
  }
  return null;
}

/**
 * Resolves governance jurisdiction from countryCode (preferred) or legacy `country` field.
 */
export function resolveSupplierJurisdictionCode(
  country?: string | null,
  countryCode?: string | null,
): SupplierJurisdictionCode {
  return (
    normalizeSupplierJurisdictionCode(countryCode) ??
    normalizeSupplierJurisdictionCode(country) ??
    'ZA'
  );
}

export function resolveJurisdictionInput(
  country?: string | null,
  countryCode?: string | null,
): { jurisdiction: SupplierJurisdictionCode; country: string; countryCode: string } {
  const jurisdiction = resolveSupplierJurisdictionCode(country, countryCode);
  const code = jurisdiction;
  return {
    jurisdiction,
    countryCode: code,
    country: country?.trim() || code,
  };
}
