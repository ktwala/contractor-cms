import {
  formatObservationSource,
  supplierReferenceAction,
  supplierReferenceProblem,
} from '@/lib/supplier-reconciliation-copy';

describe('supplier reconciliation copy', () => {
  it('formats observation sources for operators', () => {
    expect(formatObservationSource('ORACLE_HCM')).toBe('Oracle HCM');
  });

  it('describes possible match problems and actions', () => {
    const item = {
      reconciliationKind: 'POSSIBLE_MATCH' as const,
      proposedSupplierName: 'Vertex Projects',
      observationSource: 'ORACLE_HCM',
    };
    expect(supplierReferenceProblem(item)).toBe('Possible match with "Vertex Projects"');
    expect(supplierReferenceAction(item)).toBe('Confirm supplier match');
  });

  it('describes unresolved references without a portal match', () => {
    const item = {
      reconciliationKind: 'CONFLICT' as const,
      proposedSupplierName: 'Atlas Consulting',
      observationSource: 'ORACLE_HCM',
    };
    expect(supplierReferenceProblem(item)).toBe(
      'No matching supplier in Oracle Supplier Portal',
    );
    expect(supplierReferenceAction(item)).toBe('Create or associate supplier');
  });
});
