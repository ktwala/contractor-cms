import { SupplierAuthorityMode } from '@prisma/client';
import { PERMISSIONS, WILDCARD_ALL } from '../auth/permissions.constants';
import { assertSupplierMasterCreationAllowed } from './supplier-authority.helper';
import { SupplierMasterCreationForbiddenException } from './authority.errors';

describe('assertSupplierMasterCreationAllowed (PR-CMS-AUTHORITY-1)', () => {
  const baseContext = {
    actorUserId: 'u1',
    actorOrganizationId: 'org1',
    targetOrganizationId: 'org1',
    isGlobalAccess: false,
    supplierScopeId: null,
    responsibleManagerEmployeeId: null,
  };

  it('allows create when mode is CMS_ONLY', () => {
    expect(() =>
      assertSupplierMasterCreationAllowed(
        { ...baseContext, effectivePermissions: new Set([WILDCARD_ALL]) },
        {
          supplierAuthorityMode: SupplierAuthorityMode.CMS_ONLY,
          contractorAuthorityMode: 'CMS_ONLY' as never,
        },
      ),
    ).not.toThrow();
  });

  it('blocks ORACLE_ONLY even when actor has *:*', () => {
    expect(() =>
      assertSupplierMasterCreationAllowed(
        { ...baseContext, effectivePermissions: new Set([WILDCARD_ALL]) },
        {
          supplierAuthorityMode: SupplierAuthorityMode.ORACLE_ONLY,
          contractorAuthorityMode: 'HYBRID' as never,
        },
      ),
    ).toThrow(SupplierMasterCreationForbiddenException);
  });

  it('allows ORACLE_ONLY when suppliers:governance-intake is explicit', () => {
    expect(() =>
      assertSupplierMasterCreationAllowed(
        {
          ...baseContext,
          effectivePermissions: new Set([
            PERMISSIONS.SUPPLIERS.GOVERNANCE_INTAKE,
          ]),
        },
        {
          supplierAuthorityMode: SupplierAuthorityMode.ORACLE_ONLY,
          contractorAuthorityMode: 'HYBRID' as never,
        },
      ),
    ).not.toThrow();
  });
});
