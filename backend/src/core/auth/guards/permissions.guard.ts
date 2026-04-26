import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { WILDCARD_ALL, WILDCARD_ACTION } from '../permissions.constants';
import { OrgContextOptions, ORG_CONTEXT_KEY } from '../decorators/org-context.decorator';
import { OrgContextResolverService } from './org-context-resolver.service';
import { AccessContext } from '../interfaces/access-context.interface';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private reflector: Reflector,
    private orgContextResolver: OrgContextResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Permissions() decorator — allow (authentication-only route)
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.roles) {
      return false;
    }

    // Resolve Org Context
    const orgContextOptions = this.reflector.getAllAndOverride<OrgContextOptions>(
      ORG_CONTEXT_KEY,
      [context.getHandler(), context.getClass()],
    );

    let targetOrganizationId: string | null = null;
    let isGlobalAccess = false;

    if (orgContextOptions) {
      targetOrganizationId = await this.orgContextResolver.resolveTargetOrgId(request, orgContextOptions);
      
      if (!targetOrganizationId) {
        throw new ForbiddenException('Organization context required');
      }
    }

    // Determine which roles apply
    // Global role: UserRole.organizationId = null
    // Scoped role: UserRole.organizationId = targetOrganizationId
    // If targetOrganizationId exists: allow global roles + roles scoped to that organization
    // If targetOrganizationId is missing: allow global roles only
    
    const applicableRoles = user.roles.filter((ur: any) => {
      if (ur.organizationId === null) {
        return true; // Global role always applies
      }
      if (targetOrganizationId && ur.organizationId === targetOrganizationId) {
        return true; // Scoped role applies if target matches
      }
      return false;
    });

    // Check if the user has a global role that applies (isGlobalAccess)
    // Wait, the user could have a global role (organizationId=null) that grants the needed permission.
    // We will evaluate permissions below, but we can set isGlobalAccess to true if they use a global role.
    
    // Collect all permissions from applicable roles (deduplicated)
    const userPermissions = new Set<string>(
      applicableRoles.flatMap(
        (userRole: any) => userRole.role.permissions || [],
      ),
    );

    // Check if user has ALL required permissions
    const hasAccess = requiredPermissions.every((required) =>
      this.hasPermission(userPermissions, required),
    );

    if (!hasAccess) {
      return false;
    }

    // Determine if the *access granted* is from a global role or scoped role
    // If the targetOrganizationId is known, but the user only has access because of a global role,
    // they are acting globally.
    // If they have access from a global role, they are global.
    const globalRoles = applicableRoles.filter((ur: any) => ur.organizationId === null);
    const globalPermissions = new Set<string>(
      globalRoles.flatMap((ur: any) => ur.role.permissions || [])
    );
    
    // Check if the global roles ALONE satisfy the required permissions
    isGlobalAccess = requiredPermissions.every((required) => 
      this.hasPermission(globalPermissions, required)
    );

    // Populate AccessContext
    const accessContext: AccessContext = {
      actorUserId: user.id,
      actorOrganizationId: user.organizationId || null,
      targetOrganizationId,
      isGlobalAccess,
    };
    
    request.accessContext = accessContext;

    return true;
  }

  /**
   * Checks whether the user's permission set satisfies a single required
   * permission. Supports:
   *   1. Full wildcard: `*:*` — grants everything
   *   2. Exact match: `suppliers:create` matches `suppliers:create`
   *   3. Resource wildcard: `suppliers:*` matches `suppliers:create`
   */
  private hasPermission(
    userPermissions: Set<string>,
    required: string,
  ): boolean {
    // Reject malformed permission strings
    if (!required.includes(':')) {
      this.logger.error(`Malformed permission string: "${required}"`);
      return false;
    }

    // 1. Full wildcard: *:* grants everything
    if (userPermissions.has(WILDCARD_ALL)) {
      return true;
    }

    // 2. Exact match
    if (userPermissions.has(required)) {
      return true;
    }

    // 3. Resource wildcard: suppliers:* matches suppliers:create
    const [requiredResource] = required.split(':');
    return userPermissions.has(`${requiredResource}:${WILDCARD_ACTION}`);
  }
}
