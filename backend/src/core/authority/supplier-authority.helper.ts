import { SupplierAuthorityMode } from '@prisma/client';
import { AccessContext } from '../auth/interfaces/access-context.interface';
import { PERMISSIONS } from '../auth/permissions.constants';
import { permissionSatisfied } from '../auth/utils/permission-evaluation';
import { SupplierMasterCreationForbiddenException } from './authority.errors';
import { TenantAuthorityProfile } from './authority.constants';

/**
 * PR-CMS-AUTHORITY-1 — block competing supplier master creation when Oracle is authoritative.
 * `suppliers:governance-intake` is explicit-only (never implied by `*:*`).
 */
export function assertSupplierMasterCreationAllowed(
  accessContext: AccessContext,
  authority: TenantAuthorityProfile,
): void {
  if (authority.supplierAuthorityMode !== SupplierAuthorityMode.ORACLE_ONLY) {
    return;
  }

  const perms = accessContext.effectivePermissions ?? new Set<string>();
  if (
    permissionSatisfied(perms, PERMISSIONS.SUPPLIERS.GOVERNANCE_INTAKE)
  ) {
    return;
  }

  throw new SupplierMasterCreationForbiddenException(
    authority.supplierAuthorityMode,
  );
}
