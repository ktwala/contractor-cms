/**
 * MTN demo — HCM worker supplier references that are not in Oracle Supplier Portal.
 * Assessment interprets these observations; it does not invent them.
 */

export type HcmSupplierReferenceReconciliationKind = 'POSSIBLE_MATCH' | 'CONFLICT';

export type MtnDemoHcmSupplierReference = {
  referenceName: string;
  reconciliationKind: HcmSupplierReferenceReconciliationKind;
  /** Portal supplier trading name the reference may relate to */
  proposedSupplierTradingName: string;
};

export const MTN_DEMO_HCM_SUPPLIER_REFERENCES: MtnDemoHcmSupplierReference[] = [
  {
    referenceName: 'BlueSky Field Services',
    reconciliationKind: 'POSSIBLE_MATCH',
    proposedSupplierTradingName: 'Vertex Projects',
  },
  {
    referenceName: 'Mandla Projects (Pty) Ltd',
    reconciliationKind: 'CONFLICT',
    proposedSupplierTradingName: 'Atlas Consulting',
  },
];

/** Legacy demo overlay staging IDs — removed; never counted as Oracle suppliers. */
export const REMOVED_DEMO_OVERLAY_STAGING_EXTERNAL_IDS = [
  'ORCL-SUP-MTN-GOV-CONFLICT',
  'ORCL-SUP-MTN-GOV-MATCH',
] as const;

export const HCM_SUPPLIER_REFERENCE_OBSERVATION_SOURCE = 'ORACLE_HCM' as const;
