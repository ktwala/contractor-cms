/**
 * Supplier Synchronization — EWP user-facing terminology.
 *
 * Oracle Supplier Portal / Procurement remains supplier master.
 * EWP synchronizes metadata and governs supplier participation.
 *
 * Process rules: docs/SUPPLIER_GOVERNANCE_LANGUAGE_GUIDE.md
 */
export const SUPPLIER_SYNCHRONIZATION_LABELS = {
  pageTitle: 'Supplier Synchronization',
  runSupplierReadinessAssessment: 'Assess suppliers',
  assessSuppliers: 'Assess suppliers',
  assessingSupplierReadiness: 'Assessing…',
  assessmentStatus: 'Assessment status',
  assessmentUpToDate: 'Up to date',
  newSuppliersSynchronized: 'New supplier evidence captured',
  supplierSnapshot: 'Supplier snapshot',
  lastAssessed: 'Last assessed',
  assessmentFindings: 'Assessment findings',
  basedOnSupplierSnapshot: (snapshotRef: string) =>
    `Based on supplier snapshot ${snapshotRef}`,
  supplierReadiness: 'Supplier readiness',
  governanceReview: 'Governance review',
  operationalSuppliers: 'Operational suppliers',
  synchronizedSuppliers: 'Synchronized',
  governedSuppliers: 'Operational Trust Granted',
  pendingApproval: 'Operational Trust Pending',
  suspendedSuppliers: 'Operational Trust Suspended',
  operationalSupplierReview: 'Operational supplier review',
  awaitingPromotion: 'Awaiting promotion',
  supplierMatchingRequired: 'Supplier matching required',
  awaitingAssessment: 'Awaiting assessment',
  supplierRecordsDiscovered: 'Supplier records discovered',
  recordsFailed: 'Failed',
  discoveryExceptions: 'Discovery exceptions',
  discoveryConflict: 'Conflict / possible match',
  synchronizeSuppliers: 'Synchronize suppliers',
  createGovernanceRecord: 'Create governance record',
} as const;

/** One business question per tab */
export const SUPPLIER_SYNC_PAGE_QUESTIONS = {
  overview: 'What is the latest supplier evidence snapshot?',
  history: 'What supplier evidence snapshots did we acquire?',
  governance: 'Which suppliers can EWP trust and govern?',
} as const;

export const SUPPLIER_SYNCHRONIZATION_NARRATIVE = {
  pageDescription:
    'Oracle Supplier Portal remains the supplier master. EWP captures supplier evidence snapshots and governs supplier participation within the External Workforce Platform.',
  overviewFootnote:
    'Synchronization captures what Oracle reported — not whether Operational Trust has been granted in EWP.',
  historyFootnote:
    'Each SYNC snapshot is immutable evidence from one successful synchronization run.',
  evidenceFootnote:
    'Assessment evaluates the latest snapshot on the Governance tab before readiness and resolution work begins.',
  syncCompleteToast: (count: number) =>
    `Synchronization complete — ${count} supplier record(s) captured from Oracle Supplier Portal.`,
  syncActionDescription:
    'Pull the latest supplier metadata from Oracle Supplier Portal into EWP.',
  portalMembershipFootnote:
    'Synchronization and governance promotion do not create supplier portal users or contracts. Complete supplier setup so the portal user can nominate workers against an active agreement.',
  governanceReviewFootnote:
    'Counts reflect synchronized Oracle suppliers only. Unresolved supplier references from workforce records are reviewed under Workforce Discovery → Supplier reconciliation.',
  assessmentFootnote:
    'Supplier assessment evaluates the latest snapshot for operational trust gaps. It runs when new supplier evidence is captured — not on every page visit.',
  assessmentPendingFootnote:
    'A new supplier snapshot is ready. Run supplier assessment before resolving readiness findings.',
  assessmentCurrentFootnote:
    'Assessment is current for the latest supplier snapshot. Run assessment again only after a new synchronization completes.',
  assessmentOutputsHiddenFootnote:
    'Readiness, resolution, and operational supplier counts appear after supplier assessment — not at synchronization.',
  assessmentFindingsNotRunTitle: 'Assessment has not yet been run.',
  assessmentFindingsNotRunBody:
    'Run supplier assessment on the Governance tab to generate findings for this supplier snapshot.',
  loadFailed: 'Could not load supplier synchronization operations',
  assessmentFailed: 'Supplier assessment failed',
  assessmentAlreadyCurrent:
    'Supplier assessment is already up to date for the latest supplier snapshot.',
  synchronizationRequiredForAssessment:
    'Complete supplier synchronization before running supplier assessment.',
  loading: 'Loading supplier synchronization…',
} as const;

export const SUPPLIER_SYNC_TABS = {
  overview: 'Overview',
  history: 'Snapshot History',
  governance: 'Governance',
} as const;
