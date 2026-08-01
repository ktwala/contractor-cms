import { Supplier, SupplierSourceSystem } from '@prisma/client';
import { SUPPLIER_SOURCE_SYSTEMS } from '../suppliers/supplier-source.constants';
import { SupplierSourceIdentityImmutableException } from './supplier-governance-twin.errors';

export function isOracleLinkedSupplier(supplier: {
  sourceSystem: SupplierSourceSystem;
  externalSupplierId: string | null;
}): boolean {
  return (
    supplier.sourceSystem === SUPPLIER_SOURCE_SYSTEMS.ORACLE_SUPPLIER_SAAS &&
    supplier.externalSupplierId != null &&
    supplier.externalSupplierId.trim() !== ''
  );
}

export function assertOracleSourceIdentityNotMutated(
  existing: Supplier,
  patch: Record<string, unknown>,
): void {
  if (!isOracleLinkedSupplier(existing)) {
    return;
  }

  if (
    patch.sourceSystem !== undefined &&
    patch.sourceSystem !== existing.sourceSystem
  ) {
    throw new SupplierSourceIdentityImmutableException('sourceSystem');
  }

  if (
    patch.externalSupplierId !== undefined &&
    patch.externalSupplierId !== existing.externalSupplierId
  ) {
    throw new SupplierSourceIdentityImmutableException('externalSupplierId');
  }
}

/** Synthetic governance inbox — not used for operational email delivery. */
export function governanceTwinEmail(
  organizationId: string,
  externalSupplierId: string,
): string {
  const safeId = externalSupplierId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  return `oracle.${safeId}.${organizationId.slice(0, 8)}@supplier-governance.invalid`;
}
