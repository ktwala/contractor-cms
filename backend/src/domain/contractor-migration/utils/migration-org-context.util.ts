import { BadRequestException } from '@nestjs/common';
import { AccessContext } from '../../../core/auth/interfaces/access-context.interface';

/** Resolve tenant org for migration admin routes (scoped user or explicit global override). */
export function resolveMigrationOrganizationId(
  accessContext: AccessContext,
  explicitOrganizationId?: string,
): string {
  const resolved =
    accessContext.targetOrganizationId ??
    accessContext.actorOrganizationId ??
    explicitOrganizationId ??
    null;

  if (!resolved) {
    throw new BadRequestException(
      'organizationId is required (scoped user or global admin must pass organizationId)',
    );
  }

  if (
    accessContext.targetOrganizationId &&
    explicitOrganizationId &&
    explicitOrganizationId !== accessContext.targetOrganizationId
  ) {
    throw new BadRequestException(
      'organizationId does not match your organization context',
    );
  }

  return resolved;
}
