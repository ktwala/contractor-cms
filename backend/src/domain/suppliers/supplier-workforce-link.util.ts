import { SupplierStatus } from '@prisma/client';

export type SupplierWorkforceLinkRef = {
  id: string;
  status: SupplierStatus;
  companyName: string | null;
  tradingName: string | null;
};

export function vendorFromNormalizedPayload(normalizedPayloadJson: unknown): string | null {
  const normalized = normalizedPayloadJson as { supplier?: string | null } | null;
  const vendor = normalized?.supplier?.trim();
  return vendor || null;
}

/** Match a discovered worker vendor string to a supplier master record. */
export function matchStagingVendorToSupplier(
  vendor: string,
  suppliers: SupplierWorkforceLinkRef[],
): SupplierWorkforceLinkRef | undefined {
  const needle = vendor.toLowerCase();
  return suppliers.find(
    (s) =>
      s.tradingName?.toLowerCase().includes(needle) ||
      s.companyName?.toLowerCase().includes(needle) ||
      needle.includes(s.tradingName?.toLowerCase() ?? '') ||
      needle.includes(s.companyName?.toLowerCase() ?? ''),
  );
}
