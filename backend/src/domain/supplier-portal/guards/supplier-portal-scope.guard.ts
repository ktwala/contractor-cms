import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AccessContext } from '../../../core/auth/interfaces/access-context.interface';

/**
 * PR-SUPPLIER-PORTAL-UI-1 — fail closed unless PermissionsGuard set supplierScopeId.
 */
@Injectable()
export class SupplierPortalScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const accessContext = request.accessContext as AccessContext | undefined;

    if (!accessContext?.supplierScopeId) {
      throw new ForbiddenException(
        'Active supplier membership required for supplier portal access',
      );
    }

    return true;
  }
}
