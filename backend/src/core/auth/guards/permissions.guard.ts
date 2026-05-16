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
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private reflector: Reflector,
    private orgContextResolver: OrgContextResolverService,
    private auditService: AuditService,
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
    }

    // Determine which roles apply
    // Global role: UserRole.organizationId = null
    // Scoped role: UserRole.organizationId = targetOrganizationId
    // If targetOrganizationId exists: allow global roles + roles scoped to that organization
    // If targetOrganizationId is missing: allow global roles only
    
    const applicableRoles = user.roles.filter((ur: any) => {
      // Global role: null or legacy empty string from early seed data
      if (ur.organizationId === null || ur.organizationId === '') {
        return true;
      }
      if (targetOrganizationId && ur.organizationId === targetOrganizationId) {
        return true; // Scoped role applies if target matches
      }
      return false;
    });

    // Collect all permissions from applicable roles (deduplicated)
    const userPermissions = new Set<string>(
      applicableRoles.flatMap(
        (userRole: any) => userRole.role.permissions || [],
      ),
    );

    // Any listed permission grants access (OR). Single-permission routes behave as before.
    const hasAccess = requiredPermissions.some((required) =>
      this.hasPermission(userPermissions, required),
    );

    if (!hasAccess) {
      const errorMsg = (orgContextOptions && !targetOrganizationId) 
        ? 'Organization context required or global permission insufficient' 
        : `Missing required permissions: ${requiredPermissions.join(', ')}`;
        
      this.auditService.logAction(
        user.id,
        'ACCESS_DENIED_403',
        'Route',
        request.url,
        null,
        null,
        {
          organizationId: user.organizationId || null,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: {
            requiredPermissions,
            providedPermissions: Array.from(userPermissions),
            targetOrganizationId,
            error: errorMsg
          }
        }
      );

      if (orgContextOptions && !targetOrganizationId) {
        throw new ForbiddenException(errorMsg);
      }
      return false;
    }

    // If an org context was requested but none was provided, and the user HAS access, 
    // it means they accessed it via a global role.
    if (orgContextOptions && !targetOrganizationId) {
      // Allow them to proceed globally
    }

    // Determine if the *access granted* is from a global role or scoped role
    // If the targetOrganizationId is known, but the user only has access because of a global role,
    // they are acting globally.
    // If they have access from a global role, they are global.
    const globalRoles = applicableRoles.filter(
      (ur: any) => ur.organizationId === null || ur.organizationId === '',
    );
    const globalPermissions = new Set<string>(
      globalRoles.flatMap((ur: any) => ur.role.permissions || [])
    );
    
    // Global access when a global role satisfies at least one required permission
    isGlobalAccess = requiredPermissions.some((required) =>
      this.hasPermission(globalPermissions, required),
    );

    const activeMembership = user.supplierMemberships?.find(
      (m: { isActive: boolean }) => m.isActive,
    );

    const accessViaSupplierPortal = requiredPermissions.some(
      (required) =>
        required.startsWith('supplier-') &&
        this.hasPermission(userPermissions, required),
    );

    // Fail closed: supplier-* permissions require an active SupplierMembership row scope
    if (accessViaSupplierPortal && !isGlobalAccess && !activeMembership) {
      const errorMsg =
        'Active supplier membership required for supplier-portal access';
      this.auditService.logAction(
        user.id,
        'ACCESS_DENIED_403',
        'Route',
        request.url,
        null,
        null,
        {
          organizationId: user.organizationId || null,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: {
            requiredPermissions,
            error: errorMsg,
          },
        },
      );
      throw new ForbiddenException(errorMsg);
    }

    const supplierScopeId =
      !isGlobalAccess && activeMembership ? activeMembership.supplierId : null;

    // Populate AccessContext
    const accessContext: AccessContext = {
      actorUserId: user.id,
      actorOrganizationId: user.organizationId || null,
      targetOrganizationId,
      isGlobalAccess,
      supplierScopeId,
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
