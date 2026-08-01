import {
  SupplierSourceDriftStatus,
  SupplierSourceDriftType,
} from '@prisma/client';

/** Open drift records block duplicate fingerprints until resolved/archived. */
export const OPEN_DRIFT_STATUSES: SupplierSourceDriftStatus[] = [
  SupplierSourceDriftStatus.DETECTED,
  SupplierSourceDriftStatus.CLASSIFIED,
  SupplierSourceDriftStatus.UNDER_REVIEW,
];

export function buildDriftFingerprint(input: {
  organizationId: string;
  driftType: SupplierSourceDriftType;
  supplierId?: string | null;
  externalSupplierId?: string | null;
  stagingId?: string | null;
}): string {
  return [
    input.organizationId,
    input.driftType,
    input.supplierId ?? '',
    input.externalSupplierId ?? '',
    input.stagingId ?? '',
  ].join(':');
}

export const CRITICAL_DRIFT_AGE_HOURS = 72;
