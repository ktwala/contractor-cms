/**
 * External Workforce Platform — user-facing terminology (PR-EWP-VOCABULARY-2).
 *
 * Prefer business language for HR, Procurement, Vendor Management, and Operations.
 * Workforce Discovery labels follow docs/WORKFORCE_GOVERNANCE_LANGUAGE_GUIDE.md.
 *
 * Code and schema identifiers remain Contractor* — only labels change here.
 */

/**
 * Internal accountability — who inside the organization is accountable for an external worker.
 *
 * Canonical platform concept: Internal Accountability (see docs/INTERNAL_ACCOUNTABILITY_MODEL.md).
 * Schema field: `responsibleManagerEmployeeId` on engagement.
 * Display label is tenant-configurable; default MTN / demo: **Responsible Manager**.
 */
export const INTERNAL_ACCOUNTABILITY_LABELS = {
  role: 'Responsible Manager',
  notAssignedFinding: 'No Responsible Manager assigned',
  notAssignedInline: 'Responsible Manager not assigned',
  assignAction: 'Assign a Responsible Manager',
  assignmentTask: 'Responsible Manager assignment',
  assigned: (nameOrRef: string) => `${nameOrRef}`,
} as const;

export const EXTERNAL_WORKFORCE_LABELS = {
  product: 'External Workforce',
  productPlatform: 'External Workforce Platform',
  /** Short form for narrative copy where the platform name is required */
  productShort: 'EWP',
  overview: 'Overview',
  registry: 'External Workers',
  worker: 'External worker',
  workers: 'External workers',
  workforceReview: 'Workforce review',
  workforceTimeline: 'Workforce timeline',
  /** Nav + page title — Oracle HCM discovery handover */
  workforceImport: 'Workforce Discovery',
  /** Correlation / linking of discovered workers to operational context — not IGA identity resolution */
  workforceResolution: 'Workforce Resolution',
  externalWorkforceGovernance: 'Workforce readiness',
  runWorkforceAssessment: 'Assess workforce',
  assessWorkforce: 'Assess workforce',
  assessingWorkforce: 'Assessing…',
  assessmentStatus: 'Assessment status',
  assessmentUpToDate: 'Up to date',
  newWorkforceDiscovered: 'New workforce discovered',
  discoverySnapshot: 'Discovery snapshot',
  lastAssessed: 'Last assessed',
  basedOnDiscoverySnapshot: (snapshotRef: string) =>
    `Based on discovery snapshot ${snapshotRef}`,
  sponsorAssignment: INTERNAL_ACCOUNTABILITY_LABELS.assignmentTask,
  addWorker: 'Add external worker',
  editWorker: 'Edit external worker',
  sponsoredWorkers: 'Accountable external workers',
  sponsorAccountability: 'Responsible Manager accountability',
  myResponsibleManagerAccountability: 'My responsible manager accountability',
} as const;

/** Discovery-stage metric labels — greenfield MTN demo (default reset path) */
export const WORKFORCE_DISCOVERY_METRICS = {
  latestWorkforceSnapshot: 'Latest workforce snapshot',
  workersDiscovered: 'Records discovered',
  newWorkers: 'New / unmatched',
  updatedWorkers: 'Matched to existing worker',
  unchangedWorkers: 'Unchanged',
  discoveryRunFailed: 'Failed',
  discoveryConflict: 'Conflict / possible match',
  discoveryExceptions: 'Discovery exceptions',
  discoverWorkforce: 'Discover workforce',
  discovering: 'Discovering…',
  discoveryComplete: (count: number) =>
    `Discovery complete — ${count} worker record(s) captured from Oracle HCM.`,
  discoveryCompleteMaterialized: (staged: number, materialized: number) =>
    `Discovery complete — ${staged} worker record(s) captured from Oracle HCM. ` +
    `Materialized ${materialized} external worker(s) into the registry.`,
} as const;

/** Discovery metrics when hidden comparison anchors are seeded (migration / conflict UAT only) */
export const WORKFORCE_DISCOVERY_MIGRATION_METRICS = {
  ...WORKFORCE_DISCOVERY_METRICS,
  newWorkers: 'No worker match',
  updatedWorkers: 'Matched to hidden comparison worker',
} as const;

export type WorkforceDiscoveryMetricLabels =
  | typeof WORKFORCE_DISCOVERY_METRICS
  | typeof WORKFORCE_DISCOVERY_MIGRATION_METRICS;

export function resolveWorkforceDiscoveryMetrics(
  migrationComparisonMode: boolean,
): WorkforceDiscoveryMetricLabels {
  return migrationComparisonMode
    ? WORKFORCE_DISCOVERY_MIGRATION_METRICS
    : WORKFORCE_DISCOVERY_METRICS;
}

/** One business question per tab */
export const WORKFORCE_DISCOVERY_PAGE_QUESTIONS = {
  overview: 'What is the latest workforce evidence snapshot?',
  history: 'What workforce evidence snapshots did we acquire?',
  governance: 'Which workers can EWP trust and govern?',
  reconciliation:
    'Can every supplier reference from workforce records be linked to one supplier in Oracle Supplier Portal?',
} as const;

/** Workforce readiness — assessment reasons (Governance tab; reasons may overlap) */
export const WORKFORCE_READINESS_METRICS = {
  awaitingAssessment: 'Awaiting assessment',
  workersNotYetOperational: 'Workers not yet operational',
  readinessReasonsDetected: 'Readiness reasons detected',
  /** @deprecated key name — display uses Responsible Manager (internal accountability) */
  unsponsoredWorkers: INTERNAL_ACCOUNTABILITY_LABELS.notAssignedFinding,
  responsibleManagerNotAssigned: INTERNAL_ACCOUNTABILITY_LABELS.notAssignedFinding,
  missingSupplierLink: 'Supplier reference not linked',
  workforceResolutionRequired: 'Unlinked worker',
  duplicateWorker: 'Duplicate worker',
  manualReviewRequired: 'Manual review',
  resolution: 'Resolution',
  assessmentFindings: 'Assessment findings',
} as const;

/** Explicit population denominators — every Governance tab tile must declare what it counts. */
export const WORKFORCE_TELEMETRY_POPULATION_SCOPES = {
  assessedStagingWorkers:
    'Assessed HCM staging workers (discovery snapshot — not yet operationalized)',
  assessedStagingFindings: 'Readiness findings over assessed staging workers (may overlap)',
  supplierGovernanceProjection:
    'Supplier-level projection over the same assessed staging population',
  workforceResolutionTasks:
    'Open workforce resolution task records (workforce gaps only — not Supplier Governance)',
  materializedHcmContractors:
    'Materialized HCM contractors in the CMS workforce registry',
  operationalWorkforceState:
    'Lifecycle state views over the CMS registry (categories may overlap — not a partition of assessment)',
} as const;

/** Three governance dimensions on Workforce Discovery — not additive totals. */
export const WORKFORCE_DISCOVERY_DIMENSIONS = {
  assessment: {
    title: 'Worker assessment',
    question: 'What is wrong with this worker?',
  },
  operationalReadiness: {
    title: 'Operational readiness',
    question: 'Can this worker become operational?',
  },
  operationalState: {
    title: 'Operational workforce state',
    question: 'What lifecycle state is each materialized worker in?',
  },
} as const;

export function formatPopulationDenominator(scope: string, total?: number): string {
  if (total == null || total <= 0) return `Population: ${scope}`;
  return `Population: ${total} — ${scope}`;
}

/** Governance tab — section questions (presenter-facing; no backend jargon) */
export const WORKFORCE_GOVERNANCE_SECTIONS = {
  readiness: {
    title: 'Worker assessment findings',
    dimension: WORKFORCE_DISCOVERY_DIMENSIONS.assessment.title,
    beforeAssessment:
      'How many worker records are in the discovery snapshot awaiting assessment?',
    afterAssessment: 'Which readiness reasons apply to assessed workers?',
    populationFootnote: WORKFORCE_TELEMETRY_POPULATION_SCOPES.assessedStagingWorkers,
    reasonsHeading: 'Readiness reasons',
    overlapFootnote:
      'These findings may overlap. One worker can have more than one reason. Counts are not partitions of a single total.',
  },
  externalGovernanceDependencies: {
    title: 'External governance dependencies',
    intro:
      'Governance decisions outside workforce assessment that affect whether workers can be operationalized.',
    supplierGovernanceHeading: 'Supplier Governance',
    liveProjectionFootnote:
      'Live projection from Supplier Governance — updates when Operational Trust changes, without rerunning workforce assessment.',
    inclusionFootnote:
      'Workers affected by Operational Trust are drawn from the same assessed worker population shown above. They may also appear in individual readiness findings above.',
  },
  operationalWorkforce: {
    title: 'Operational workforce state',
    dimension: WORKFORCE_DISCOVERY_DIMENSIONS.operationalState.title,
    question: WORKFORCE_DISCOVERY_DIMENSIONS.operationalState.question,
    populationFootnote: WORKFORCE_TELEMETRY_POPULATION_SCOPES.operationalWorkforceState,
    policyFootnote:
      'Restricted by policy is the outcome of Policy Evaluation — not a discovered finding. Policy consumes governance truths; it does not own them.',
  },
  resolution: {
    title: 'Workforce resolution',
    dimension: WORKFORCE_DISCOVERY_DIMENSIONS.operationalReadiness.title,
    question: 'What owned tasks close workforce readiness gaps?',
    populationFootnote: WORKFORCE_TELEMETRY_POPULATION_SCOPES.workforceResolutionTasks,
    supplierGovernanceExcludedFootnote:
      'Supplier Operational Trust (Grant / Suspend / Restore) is resolved under Supplier Administration — not as workforce resolution tasks here.',
  },
  assessmentFindings: {
    title: 'Assessment findings',
    question: 'Which assessed gaps are registered for human follow-up?',
  },
  operationalRisk: {
    title: 'Connector operational risk',
    question: 'Are discovery connector runs healthy? (Optional — skip for executive demos.)',
  },
} as const;

/** Assessment findings summary tiles (Governance tab) */
export const WORKFORCE_ASSESSMENT_FINDING_METRICS = {
  responsibleManagerNotAssigned: INTERNAL_ACCOUNTABILITY_LABELS.notAssignedFinding,
  unlinkedWorkers: 'Unlinked workers',
  missingSupplier: 'Supplier reference not linked',
  /** @deprecated Prefer pending/suspended split — kept for transitional copy */
  operationalTrustNotGranted: 'Supplier Operational Trust not granted',
  workersBlockedPendingTrust: 'Pending supplier decision',
  workersBlockedSuspendedSupplier: 'Suspended supplier',
} as const;

/** Resolution queue summary (Governance tab) */
export const WORKFORCE_RESOLUTION_METRICS = {
  activeResolutionTasks: 'Active resolution tasks',
  responsibleManagerOpen: `${INTERNAL_ACCOUNTABILITY_LABELS.role} (open tasks)`,
  policyRestrictionsActive: 'Policy restrictions active',
  criticalUnresolved: 'Critical unresolved (open tasks)',
  assignResponsibleManager: INTERNAL_ACCOUNTABILITY_LABELS.assignAction,
} as const;

/** Operational workforce — lifecycle states over materialized CMS registry (Governance tab) */
export const WORKFORCE_OPERATIONAL_METRICS = {
  operationallyReady: 'Operational',
  blocked: 'Blocked',
  restricted: 'Restricted by policy',
  suspendedInactive: 'Suspended / inactive',
  exited: 'Exited',
} as const;

/** Workforce Discovery page — product narrative (Oracle HCM → EWP handover) */
export const WORKFORCE_IMPORT_NARRATIVE = {
  pageDescription:
    'Oracle HCM provides the initial contractor workforce. EWP discovers the workforce, assesses operational trust, and thereafter manages the external workforce lifecycle independently of HCM.',
  overviewFootnote:
    'Acquire workforce evidence from Oracle HCM. Operational readiness is evaluated on the Governance tab — not during discovery.',
  historyFootnote:
    'Each completed discovery creates an immutable workforce snapshot. Assessment and governance consume that snapshot as evidence.',
  evidenceFootnote:
    'Discovery records what Oracle HCM reported. Operational readiness is evaluated during Workforce Assessment.',
  discoveryActionDescription:
    'Acquire the latest workforce records from Oracle HCM into an evidence snapshot.',
  governanceSectionFootnote:
    'Assessment counts use the discovery snapshot staging population. They do not add up to operational workforce registry totals below.',
  operationalWorkforceFootnote:
    'Lifecycle state over materialized CMS contractors — not the assessed staging population above. Restricted by policy reflects a Policy Evaluation decision. Tiles may overlap; they are not partitions.',
  workforceResolutionFootnote:
    `Resolve imported workers against suppliers, ${INTERNAL_ACCOUNTABILITY_LABELS.role.toLowerCase()}s, and operational records — not digital identity correlation (that belongs to IGA).`,
  assessmentFootnote:
    'Workforce assessment evaluates the latest discovery snapshot for operational readiness gaps. It runs when new workforce is discovered — not on every page visit.',
  assessmentPendingFootnote:
    'Assessment has not run yet. Counts below show only how many records await evaluation — not why they fail readiness.',
  assessmentCurrentFootnote:
    'Assessment is current for the latest discovery snapshot. Run assessment again only after a new discovery run completes.',
  assessmentOutputsHiddenFootnote:
    'Readiness, resolution, and findings appear after workforce assessment — not at discovery.',
  assessmentFindingsNotRunTitle: 'Assessment has not yet been run.',
  assessmentFindingsNotRunBody:
    'Run workforce assessment to evaluate the discovery snapshot and generate findings.',
  remediationFootnote:
    `Workforce resolution tasks are open task records for workforce-side gaps — ${INTERNAL_ACCOUNTABILITY_LABELS.assignAction.toLowerCase()}, supplier linkage, manual review, and policy restrictions. One worker can have multiple tasks. Supplier Governance Operational Trust is excluded.`,
  responsibleManagerAlert: (count: number) =>
    count === 1
      ? `1 worker has ${INTERNAL_ACCOUNTABILITY_LABELS.notAssignedInline.toLowerCase()}. Open Resolution to ${INTERNAL_ACCOUNTABILITY_LABELS.assignAction.toLowerCase()} — the worker stays active until the gap closes.`
      : `${count} workers have ${INTERNAL_ACCOUNTABILITY_LABELS.notAssignedInline.toLowerCase()}. Open Resolution to ${INTERNAL_ACCOUNTABILITY_LABELS.assignAction.toLowerCase()} — workers stay active until gaps close.`,
  /** @deprecated use responsibleManagerAlert */
  unsponsoredAlert: (count: number) =>
    count === 1
      ? `1 worker has ${INTERNAL_ACCOUNTABILITY_LABELS.notAssignedInline.toLowerCase()}. Open Resolution to ${INTERNAL_ACCOUNTABILITY_LABELS.assignAction.toLowerCase()} — the worker stays active until the gap closes.`
      : `${count} workers have ${INTERNAL_ACCOUNTABILITY_LABELS.notAssignedInline.toLowerCase()}. Open Resolution to ${INTERNAL_ACCOUNTABILITY_LABELS.assignAction.toLowerCase()} — workers stay active until gaps close.`,
  orgContextRequired:
    'Workforce Discovery requires an organization-scoped login. Use workforce.import@ewp.demo for connector demos, or re-seed so ops.admin@ewp.demo is linked to Demo Organization.',
  loadFailed: 'Could not load workforce discovery operations',
  assessmentFailed: 'Workforce assessment failed',
  assessmentAlreadyCurrent: 'Workforce assessment is already up to date for the latest discovery snapshot.',
  discoveryRequiredForAssessment: 'Complete workforce discovery before running workforce assessment.',
  loading: 'Loading workforce discovery…',
} as const;

export const WORKFORCE_IMPORT_TABS = {
  overview: 'Overview',
  history: 'Snapshot History',
  governance: 'Governance',
  reconciliation: 'Supplier reconciliation',
  cutover: 'Cutover',
} as const;

/** Capability-aligned sidebar section headings (PR-NAV-CAPABILITY-IA-1). */
export const CAPABILITY_NAV_LABELS = {
  supplierAdministration: 'Supplier Administration',
  workforceAdministration: 'Workforce Administration',
  engagementAdministration: 'Engagement Administration',
  supplierPortal: 'Supplier portal',
  governance: 'Governance',
  administration: 'Administration',
} as const;

export const GOVERNANCE_NAV_LABELS = {
  auditLogs: 'Audit Logs',
  governanceStatus: 'Policy evaluation',
  exceptions: 'Policy exceptions',
  securityInsights: 'Security Insights',
} as const;
