type ReconciliationKind = 'POSSIBLE_MATCH' | 'CONFLICT';

type WorkItemLike = {
  reconciliationKind: ReconciliationKind;
  proposedSupplierName: string | null;
  observationSource: string;
};

/** Operator-facing source label — never raw enum codes. */
export function formatObservationSource(source: string): string {
  switch (source) {
    case 'ORACLE_HCM':
      return 'Oracle HCM';
    default:
      return source.replace(/_/g, ' ');
  }
}

/** Why the reference could not be automatically matched. */
export function supplierReferenceProblem(item: WorkItemLike): string {
  if (item.reconciliationKind === 'POSSIBLE_MATCH' && item.proposedSupplierName) {
    return `Possible match with "${item.proposedSupplierName}"`;
  }
  return 'No matching supplier in Oracle Supplier Portal';
}

/** What the operator should do next. */
export function supplierReferenceAction(item: WorkItemLike): string {
  if (item.reconciliationKind === 'POSSIBLE_MATCH') {
    return 'Confirm supplier match';
  }
  return 'Create or associate supplier';
}
