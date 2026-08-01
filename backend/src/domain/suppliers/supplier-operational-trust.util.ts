import { BadRequestException } from '@nestjs/common';
import { SupplierStatus } from '@prisma/client';

/** Operational Trust Granted — supplier may participate in EWP workforce operations. */
export function isSupplierOperationalTrustGranted(status: SupplierStatus | string): boolean {
  return status === SupplierStatus.ACTIVE;
}

export function assertSupplierOperationalTrustGranted(input: {
  status: SupplierStatus | string;
  supplierName?: string;
}): void {
  if (isSupplierOperationalTrustGranted(input.status)) {
    return;
  }
  const label = input.supplierName ? ` (${input.supplierName})` : '';
  throw new BadRequestException(
    `Supplier Operational Trust not granted${label}. Resolve under Supplier Governance before continuing.`,
  );
}
