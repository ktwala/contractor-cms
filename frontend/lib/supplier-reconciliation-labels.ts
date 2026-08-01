/**
 * Supplier reference reconciliation — operator language.
 *
 * Owned by Workforce Discovery: unresolved supplier references are observed
 * when workers reference names that cannot be linked to Oracle Supplier Portal.
 */
export const SUPPLIER_RECONCILIATION_LABELS = {
  pageTitle: 'Supplier reconciliation',
  sectionTitle: 'Supplier references requiring review',
  reviewQueue: 'Review queue',
  supplierReference: 'Supplier reference',
  observedIn: 'Observed in',
  problem: 'Problem',
  recommendedAction: 'Recommended action',
} as const;

export const SUPPLIER_RECONCILIATION_NARRATIVE = {
  pageQuestion:
    'Can every supplier reference from workforce records be linked to one supplier in Oracle Supplier Portal?',
  footnote:
    'These names come from workforce records — not from Oracle Supplier Portal. Link each reference to a supplier in the portal, or create a new supplier.',
  emptyTitle: 'All supplier references are resolved',
  emptyBody:
    'Every worker supplier reference currently matches a supplier in Oracle Supplier Portal. No reconciliation work is required.',
  pendingAssessmentTitle: 'Assessment has not yet been run.',
  pendingAssessmentBody:
    'Run workforce assessment on the Governance tab to identify supplier references that cannot be linked to the supplier master.',
  discoveryRequired:
    'Complete workforce discovery before supplier references can be reviewed.',
  loadFailed: 'Could not load supplier references.',
  loading: 'Loading supplier references…',
  basedOnDiscoverySnapshot: (snapshotRef: string) =>
    `Based on discovery snapshot ${snapshotRef}`,
} as const;
