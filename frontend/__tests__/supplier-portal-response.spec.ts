import {
  unwrapSupplierPortalDashboard,
  unwrapSupplierPortalList,
  unwrapSupplierPortalProfile,
} from '@/lib/supplier-portal-response';

describe('supplier-portal-response', () => {
  it('unwraps profile envelope', () => {
    const result = unwrapSupplierPortalProfile({
      status: 'ok',
      supplier_context: { supplier_id: 's1', organization_id: 'o1' },
      data: { id: 's1', companyName: 'Acme' },
    });
    expect(result.profile?.companyName).toBe('Acme');
    expect(result.supplierContext?.supplier_id).toBe('s1');
  });

  it('unwraps empty contractors list with empty_state', () => {
    const result = unwrapSupplierPortalList({
      status: 'ok',
      supplier_context: { supplier_id: 's1', organization_id: 'o1' },
      data: [],
      empty_state: 'NO_CONTRACTORS',
      pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
    });
    expect(result.items).toEqual([]);
    expect(result.emptyState).toBe('NO_CONTRACTORS');
  });

  it('unwraps dashboard envelope', () => {
    const data = unwrapSupplierPortalDashboard({
      status: 'ok',
      supplier_context: { supplier_id: 's1', organization_id: null },
      data: {
        profile: { available: true, display_name: 'Acme', status: 'ACTIVE' },
        contractors: { count: 2 },
        timesheets: { total: 0, pending: 0, approved: 0, rejected: 0, draft: 0 },
      },
    });
    expect(data?.contractors.count).toBe(2);
  });
});
