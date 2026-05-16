import {
  applySupplierContractorScope,
  applySupplierEntityScope,
} from './supplier-scope.helper';
import { AccessContext } from '../interfaces/access-context.interface';

describe('supplier-scope.helper', () => {
  const scoped: AccessContext = {
    actorUserId: 'u1',
    actorOrganizationId: 'org1',
    targetOrganizationId: 'org1',
    isGlobalAccess: false,
    supplierScopeId: 'sup-demo',
  };

  const unscoped: AccessContext = {
    ...scoped,
    supplierScopeId: null,
  };

  it('applySupplierEntityScope pins supplier id when membership scope is active', () => {
    const where: Record<string, unknown> = { organizationId: 'org1' };
    applySupplierEntityScope(where, scoped);
    expect(where.id).toBe('sup-demo');
  });

  it('applySupplierEntityScope is a no-op without membership scope', () => {
    const where: Record<string, unknown> = { organizationId: 'org1' };
    applySupplierEntityScope(where, unscoped);
    expect(where.id).toBeUndefined();
  });

  it('applySupplierContractorScope adds contractor.supplierId filter', () => {
    const where: Record<string, unknown> = {};
    applySupplierContractorScope(where, scoped);
    expect(where.contractor).toEqual({ supplierId: 'sup-demo' });
  });
});
