import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

// Optional OR-mode permissions metadata key
export const ANY_PERMISSIONS_KEY = 'any_permissions';

/**
 * Default behavior: require ALL permissions (AND).
 * Example: @Permissions('employee:write')
 */
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * OR behavior: require ANY of the permissions listed.
 * Example: @AnyPermissions('reports:read', 'reports:export')
 */
export const AnyPermissions = (...permissions: string[]) =>
  SetMetadata(ANY_PERMISSIONS_KEY, permissions);

// Alias for backward compatibility
export const RequirePermissions = Permissions;
