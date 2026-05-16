import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { WILDCARD_ACTION, WILDCARD_ALL } from '../../auth/permissions.constants';
import { AuditService } from '../../audit/audit.service';
import type { IntegrationActorContext } from '../extid-events.types';

@Injectable()
export class IntegrationPermissionsGuard implements CanActivate {
  private readonly logger = new Logger(IntegrationPermissionsGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsGuard: PermissionsGuard,
    private readonly auditService: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    if (user.apiKeyId) {
      const scopes = new Set<string>(user.scopes ?? []);
      const hasAccess = requiredPermissions.every((required) =>
        this.hasPermission(scopes, required),
      );

      if (!hasAccess) {
        await this.auditService.logAction(
          null,
          'ACCESS_DENIED_403',
          'ExtidEventFeed',
          request.url,
          null,
          null,
          {
            organizationId: user.organizationId ?? null,
            metadata: {
              apiKeyId: user.apiKeyId,
              requiredPermissions,
              providedScopes: Array.from(scopes),
            },
          },
        );
        return false;
      }

      request.accessContext = {
        actorUserId: null,
        actorOrganizationId: user.organizationId ?? null,
        targetOrganizationId: user.organizationId ?? null,
        isGlobalAccess: user.organizationId == null,
      };

      request.integrationActor = {
        kind: 'api_key',
        apiKeyId: user.apiKeyId,
        organizationScope: user.organizationId ?? null,
      } satisfies IntegrationActorContext;

      return true;
    }

    const ok = await this.permissionsGuard.canActivate(context);
    if (!ok) {
      return false;
    }

    const accessContext = request.accessContext;
    const organizationScope: string | null = accessContext?.isGlobalAccess
      ? null
      : accessContext?.targetOrganizationId ?? accessContext?.actorOrganizationId ?? null;

    request.integrationActor = {
      kind: 'user',
      userId: user.id,
      organizationScope,
    } satisfies IntegrationActorContext;

    return true;
  }

  private hasPermission(userPermissions: Set<string>, required: string): boolean {
    if (!required.includes(':')) {
      this.logger.error(`Malformed permission string: "${required}"`);
      return false;
    }

    if (userPermissions.has(WILDCARD_ALL)) {
      return true;
    }

    if (userPermissions.has(required)) {
      return true;
    }

    const [requiredResource] = required.split(':');
    return userPermissions.has(`${requiredResource}:${WILDCARD_ACTION}`);
  }
}
