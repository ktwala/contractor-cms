import { SupplierStatus } from '@prisma/client';
import { SupplierLifecycleService } from '../supplier-lifecycle.service';
import {
  InvalidSupplierStatusTransitionException,
  SupplierSelfApprovalForbiddenException,
} from '../supplier-lifecycle.errors';
import { PERMISSIONS } from '../../../core/auth/permissions.constants';
import { AccessContext } from '../../../core/auth/interfaces/access-context.interface';

describe('SupplierLifecycleService', () => {
  const service = new SupplierLifecycleService();

  const baseContext = (perms: string[], supplierScopeId: string | null = null): AccessContext => ({
    actorUserId: 'user-1',
    actorOrganizationId: 'org-1',
    targetOrganizationId: 'org-1',
    isGlobalAccess: false,
    effectivePermissions: new Set(perms),
    supplierScopeId,
    responsibleManagerEmployeeId: null,
  });

  it('allows PENDING_APPROVAL → ACTIVE with suppliers:approve', () => {
    expect(() =>
      service.assertTransitionAllowed(
        SupplierStatus.PENDING_APPROVAL,
        SupplierStatus.ACTIVE,
      ),
    ).not.toThrow();

    expect(() =>
      service.assertActorMayTransition(
        baseContext([PERMISSIONS.SUPPLIERS.APPROVE]),
        SupplierStatus.PENDING_APPROVAL,
        SupplierStatus.ACTIVE,
        'supplier-1',
      ),
    ).not.toThrow();
  });

  it('rejects OFFBOARDED → ACTIVE', () => {
    expect(() =>
      service.assertTransitionAllowed(
        SupplierStatus.OFFBOARDED,
        SupplierStatus.ACTIVE,
      ),
    ).toThrow(InvalidSupplierStatusTransitionException);
  });

  it('rejects ARCHIVED → ACTIVE', () => {
    expect(() =>
      service.assertTransitionAllowed(
        SupplierStatus.ARCHIVED,
        SupplierStatus.ACTIVE,
      ),
    ).toThrow(InvalidSupplierStatusTransitionException);
  });

  it('rejects ACTIVE → DRAFT', () => {
    expect(() =>
      service.assertTransitionAllowed(SupplierStatus.ACTIVE, SupplierStatus.DRAFT),
    ).toThrow(InvalidSupplierStatusTransitionException);
  });

  it('requires suppliers:suspend for ACTIVE → SUSPENDED', () => {
    expect(() =>
      service.assertActorMayTransition(
        baseContext([PERMISSIONS.SUPPLIERS.READ]),
        SupplierStatus.ACTIVE,
        SupplierStatus.SUSPENDED,
        'supplier-1',
      ),
    ).toThrow();
  });

  it('blocks self-approval for membership-scoped actor', () => {
    expect(() =>
      service.assertActorMayTransition(
        baseContext([PERMISSIONS.SUPPLIERS.APPROVE], 'supplier-1'),
        SupplierStatus.PENDING_APPROVAL,
        SupplierStatus.ACTIVE,
        'supplier-1',
      ),
    ).toThrow(SupplierSelfApprovalForbiddenException);
  });

  it('resolves audit actions for approval', () => {
    const actions = service.resolveAuditActions(
      SupplierStatus.PENDING_APPROVAL,
      SupplierStatus.ACTIVE,
    );
    expect(actions).toContain('SUPPLIER_APPROVED');
    expect(actions).toContain('SUPPLIER_STATUS_CHANGED');
  });

  it('resolves audit actions for restore after suspension', () => {
    const actions = service.resolveAuditActions(
      SupplierStatus.SUSPENDED,
      SupplierStatus.ACTIVE,
    );
    expect(actions).toContain('SUPPLIER_APPROVED');
    expect(actions).toContain('SUPPLIER_STATUS_CHANGED');
  });
});