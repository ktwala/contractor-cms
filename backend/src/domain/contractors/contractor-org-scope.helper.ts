import { AccessContext } from '../../core/auth/interfaces/access-context.interface';

/** Tenant scope for contractor reads — ADR-013 independent workers use organizationId directly. */
export function applyContractorOrganizationScope(
  where: Record<string, unknown>,
  accessContext: AccessContext,
): void {
  if (accessContext.isGlobalAccess || !accessContext.targetOrganizationId) {
    return;
  }
  where.organizationId = accessContext.targetOrganizationId;
}
