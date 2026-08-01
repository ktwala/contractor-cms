import { ForbiddenException, Injectable } from '@nestjs/common';
import { SupplierStatus } from '@prisma/client';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { permissionSatisfied } from '../../core/auth/utils/permission-evaluation';
import {
  SUPPLIER_STATUS_TRANSITIONS,
  auditActionForTransition,
  isSupplierApprovalTransition,
  requiredPermissionForTransition,
} from './supplier-lifecycle.constants';
import {
  InvalidSupplierStatusTransitionException,
  SupplierSelfApprovalForbiddenException,
} from './supplier-lifecycle.errors';

@Injectable()
export class SupplierLifecycleService {
  assertTransitionAllowed(
    currentStatus: SupplierStatus,
    targetStatus: SupplierStatus,
  ): void {
    if (currentStatus === targetStatus) {
      throw new InvalidSupplierStatusTransitionException(
        currentStatus,
        targetStatus,
        'Supplier is already in the requested status',
      );
    }

    const allowed = SUPPLIER_STATUS_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(targetStatus)) {
      throw new InvalidSupplierStatusTransitionException(
        currentStatus,
        targetStatus,
      );
    }
  }

  assertActorMayTransition(
    accessContext: AccessContext,
    currentStatus: SupplierStatus,
    targetStatus: SupplierStatus,
    supplierId: string,
  ): void {
    const required = requiredPermissionForTransition(currentStatus, targetStatus);
    const perms = accessContext.effectivePermissions ?? [];

    if (!permissionSatisfied(new Set(perms), required)) {
      throw new ForbiddenException(
        `Missing required permission for transition: ${required}`,
      );
    }

    if (
      isSupplierApprovalTransition(currentStatus, targetStatus) &&
      accessContext.supplierScopeId &&
      accessContext.supplierScopeId === supplierId
    ) {
      throw new SupplierSelfApprovalForbiddenException();
    }
  }

  resolveAuditActions(
    from: SupplierStatus,
    to: SupplierStatus,
  ): ReturnType<typeof auditActionForTransition> {
    return auditActionForTransition(from, to);
  }
}
