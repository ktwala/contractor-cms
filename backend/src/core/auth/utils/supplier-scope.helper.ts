import { NotFoundException } from '@nestjs/common';
import { AccessContext } from '../interfaces/access-context.interface';

/**
 * For single-entity routes: fail closed when the requested id is outside membership scope.
 */
export function assertSupplierEntityAccess(
  accessContext: AccessContext,
  entityId: string,
): void {
  if (accessContext.supplierScopeId && entityId !== accessContext.supplierScopeId) {
    throw new NotFoundException('Supplier not found');
  }
}

/** Restrict supplier list queries to the portal user's bound supplier. */
export function applySupplierEntityScope(
  where: Record<string, unknown>,
  accessContext: AccessContext,
): void {
  if (accessContext.supplierScopeId) {
    where.id = accessContext.supplierScopeId;
  }
}

/** Restrict queries that reach suppliers via contractor relation. */
export function applySupplierContractorScope(
  where: Record<string, unknown>,
  accessContext: AccessContext,
): void {
  if (!accessContext.supplierScopeId) {
    return;
  }
  const existing = (where.contractor as Record<string, unknown>) || {};
  where.contractor = {
    ...existing,
    supplierId: accessContext.supplierScopeId,
  };
}
