import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PERMISSIONS_KEY, ANY_PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AuditService } from '../../core/audit/audit.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private auditService: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // AND permissions (default)
    const requiredAll = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // OR permissions (optional)
    const requiredAny = this.reflector.getAllAndOverride<string[]>(ANY_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if ((!requiredAll || requiredAll.length === 0) && (!requiredAny || requiredAny.length === 0)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const { user } = request;
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const userId = (user as any).sub;
    const userRoles: string[] = (user as any).roles || [];
    const endpoint = request.url || request.path || '';
    const method = request.method || '';

    // v1.1: Extract legal entity from request for scope-aware audit
    const legalEntityId =
      (request.params as any)?.legal_entity_id ||
      (request.body as any)?.legalEntityId ||
      (request.body as any)?.legal_entity_id ||
      (request.query as any)?.legalEntityId ||
      (request.query as any)?.legal_entity_id ||
      request.headers?.['x-legal-entity-id'] ||
      null;
    const roleAssignments = (user as any).roleAssignments as
      | Array<{ role: string; legalEntityId: string | null; scopeType?: string }>
      | undefined;

    /**
     * IMPORTANT:
     * Remove tenant ADMIN bypass. It defeats RBAC + SoD.
     * If you truly need a break-glass/platform role, use a separate role name.
     */
    if (userRoles.includes('PLATFORM_SUPERADMIN')) {
      await this.auditService.logPlatformSuperadminAccess({
        userId,
        route: endpoint,
        method,
        legalEntityId,
        roleAssignments,
        ipAddress: request.ip,
        userAgent: request.get('user-agent'),
      });
      return true;
    }

    const userPerms: string[] = (user as any).permissions || [];

    // AND logic: must have ALL permissions listed in @Permissions(...)
    if (requiredAll && requiredAll.length > 0) {
      const missing = requiredAll.filter((p) => !userPerms.includes(p));
      if (missing.length > 0) {
        await this.auditService.logPermissionDenied({
          userId,
          requiredPermissions: missing,
          userRoles,
          endpoint,
          method,
          legalEntityId,
          roleAssignments,
          ipAddress: request.ip,
          userAgent: request.get('user-agent'),
        });
        throw new ForbiddenException(
          `Missing required permission(s): ${missing.join(', ')}`,
        );
      }
    }

    // OR logic: must have ANY permission listed in @AnyPermissions(...)
    if (requiredAny && requiredAny.length > 0) {
      const hasAny = requiredAny.some((p) => userPerms.includes(p));
      if (!hasAny) {
        await this.auditService.logPermissionDenied({
          userId,
          requiredPermissions: requiredAny,
          userRoles,
          endpoint,
          method,
          legalEntityId,
          roleAssignments,
          ipAddress: request.ip,
          userAgent: request.get('user-agent'),
        });
        throw new ForbiddenException(
          `Missing any of required permission(s): ${requiredAny.join(', ')}`,
        );
      }
    }

    return true;
  }
}
