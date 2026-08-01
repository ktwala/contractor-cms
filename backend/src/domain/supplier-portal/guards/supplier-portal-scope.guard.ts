import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AccessContext } from '../../../core/auth/interfaces/access-context.interface';
import { supplierMembershipRequiredException } from '../supplier-portal.errors';

/**
 * PR-SUPPLIER-PORTAL-UI-1 — fail closed unless PermissionsGuard set supplierScopeId.
 */
@Injectable()
export class SupplierPortalScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const accessContext = request.accessContext as AccessContext | undefined;

    if (!accessContext?.supplierScopeId) {
      throw supplierMembershipRequiredException();
    }

    return true;
  }
}
