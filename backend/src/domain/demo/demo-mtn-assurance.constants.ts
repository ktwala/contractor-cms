/**
 * MTN Continuous Workforce Assurance — demo personas (story definitions only).
 *
 * NOT wired to detection, UI, or seed scripts yet.
 * Lifecycle (FROZEN): docs/EXTERNAL_WORKFORCE_LIFECYCLE.md
 * Assurance detail: docs/CONTINUOUS_WORKFORCE_ASSURANCE.md
 * Stories: docs/DEMO-MTN-ASSURANCE-STORIES.md
 *
 * Assessment demo (discovery/readiness) remains in demo-mtn-story.constants.ts.
 */

/** Assurance domain — exactly one per finding. Frozen discipline labels. */
export type AssuranceDomain =
  | 'ACCOUNTABILITY'
  | 'ENGAGEMENT'
  | 'SUPPLIER'
  | 'WORKFORCE'
  | 'ACCESS';

export const ASSURANCE_DOMAIN_LABELS: Record<AssuranceDomain, string> = {
  ACCOUNTABILITY: 'Accountability Assurance',
  ENGAGEMENT: 'Engagement Assurance',
  SUPPLIER: 'Supplier Assurance',
  WORKFORCE: 'Workforce Assurance',
  ACCESS: 'Access Assurance',
};

export type AssuranceFindingCode =
  | 'ACCOUNTABILITY_MISSING'
  | 'ACCOUNTABILITY_INACTIVE'
  | 'ACCOUNTABILITY_INVALID'
  | 'ENGAGEMENT_CONTRACT_EXPIRED'
  | 'ENGAGEMENT_CONTRACT_EXPIRING'
  | 'ENGAGEMENT_CONFLICT'
  | 'ENGAGEMENT_MISSING'
  | 'SUPPLIER_SUSPENDED'
  | 'SUPPLIER_NOT_SYNCHRONIZED'
  | 'SUPPLIER_REMOVED'
  | 'WORKFORCE_DUPLICATE'
  | 'WORKFORCE_HCM_MISMATCH'
  | 'WORKFORCE_ORPHANED'
  | 'ACCESS_AFTER_ENGAGEMENT_END'
  | 'ACCESS_WITHOUT_ACCOUNTABILITY'
  | 'ACCESS_DORMANT';

/** Triage outcome — not every finding becomes an action. See EXTERNAL_WORKFORCE_LIFECYCLE.md */
export type AssuranceDecision =
  | 'COMPLIANT'
  | 'MONITOR'
  | 'REVIEW_REQUIRED'
  | 'CRITICAL';

export type AssuranceSeverity = 'HEALTHY' | 'REVIEW' | 'CRITICAL';

export type AssuranceComplianceEvidence = {
  supplierOk: boolean;
  contractOk: boolean;
  responsibleManagerOk: boolean;
  engagementOk: boolean;
  accessOk: boolean;
  lastAssuredLabel: string;
};

export type MtnAssurancePersona = {
  displayName: string;
  domain: AssuranceDomain | null;
  finding: AssuranceFindingCode | null;
  decision: AssuranceDecision;
  severity: AssuranceSeverity;
  observation: string | null;
  action: string | null;
  operatorNarrative: string;
  demoBeat: string;
  complianceEvidence?: AssuranceComplianceEvidence;
  phase?: 'PHASE_2';
};

export const MTN_DEMO_ASSURANCE_PERSONAS: MtnAssurancePersona[] = [
  {
    displayName: 'John Smith',
    domain: null,
    finding: null,
    decision: 'COMPLIANT',
    severity: 'HEALTHY',
    observation: 'All assurance domains evaluated; no policy violations',
    action: null,
    operatorNarrative:
      'Fully compliant — supplier, contract, Responsible Manager, engagement, and access aligned.',
    demoBeat: 'Prove green with positive evidence; last assured 14 days ago.',
    complianceEvidence: {
      supplierOk: true,
      contractOk: true,
      responsibleManagerOk: true,
      engagementOk: true,
      accessOk: true,
      lastAssuredLabel: '14 days ago',
    },
  },
  {
    displayName: 'Peter Molefe',
    domain: 'ENGAGEMENT',
    finding: 'ENGAGEMENT_CONTRACT_EXPIRED',
    decision: 'REVIEW_REQUIRED',
    severity: 'REVIEW',
    observation: 'Contract expired yesterday; engagement still active in EWP',
    action: 'Open governance task',
    operatorNarrative:
      'Contract expired yesterday; worker still operational — unauthorized spend and placement risk.',
    demoBeat: 'Engagement Assurance — review required, not monitor.',
  },
  {
    displayName: 'Mary Dube',
    domain: 'SUPPLIER',
    finding: 'SUPPLIER_SUSPENDED',
    decision: 'REVIEW_REQUIRED',
    severity: 'REVIEW',
    observation: 'Supplier lifecycle status changed to Suspended',
    action: 'Review operational workers under this supplier',
    operatorNarrative:
      'Supplier suspended in EWP; worker still operational — vendor relationship invalid.',
    demoBeat: 'Supplier Assurance.',
  },
  {
    displayName: 'Alex Nkosi',
    domain: 'ACCOUNTABILITY',
    finding: 'ACCOUNTABILITY_INACTIVE',
    decision: 'REVIEW_REQUIRED',
    severity: 'REVIEW',
    observation: 'Responsible Manager employee record terminated in HCM',
    action: 'Assign Responsible Manager',
    operatorNarrative:
      'Responsible Manager resigned; assignment stale — no accountable owner for decisions.',
    demoBeat: 'Accountability Assurance — inactive, not missing at import.',
  },
  {
    displayName: 'Jane Adams',
    domain: 'WORKFORCE',
    finding: 'WORKFORCE_DUPLICATE',
    decision: 'REVIEW_REQUIRED',
    severity: 'REVIEW',
    observation: 'Two operational registry records share same national ID / email',
    action: 'Merge or exit duplicate record',
    operatorNarrative:
      'Two operational records for the same person — payroll and audit ambiguity.',
    demoBeat: 'Workforce Assurance — operational duplicate.',
  },
  {
    displayName: 'Sipho Maseko',
    domain: 'ACCESS',
    finding: 'ACCESS_AFTER_ENGAGEMENT_END',
    decision: 'CRITICAL',
    severity: 'CRITICAL',
    observation: 'Engagement closed in EWP; IGA signal: Oracle account still active',
    action: 'Create IGA remediation',
    operatorNarrative:
      'Contract ended but Oracle / VPN access still active — workforce and access planes diverged.',
    demoBeat: 'Access Assurance Phase 2 — critical decision triggers IGA handoff.',
    phase: 'PHASE_2',
  },
  {
    displayName: 'David Ncube',
    domain: 'WORKFORCE',
    finding: 'WORKFORCE_ORPHANED',
    decision: 'REVIEW_REQUIRED',
    severity: 'REVIEW',
    observation: 'Supplier portal removed worker from supplier roster',
    action: 'Re-sync from portal; exit or re-nominate worker',
    operatorNarrative:
      'Supplier portal removed worker; EWP still operational — synchronization drift only EWP detects.',
    demoBeat: 'Portal drift → Workforce Assurance.',
  },
];

/** Demo persona for monitor-only path (not in main cohort — presenter reference). */
export const MTN_DEMO_ASSURANCE_MONITOR_EXAMPLE = {
  displayName: '(reference) Contract expiring in 28 days',
  domain: 'ENGAGEMENT' as const,
  finding: 'ENGAGEMENT_CONTRACT_EXPIRING' as const,
  decision: 'MONITOR' as const,
  observation: 'Contract expires in 28 days',
  action: null,
};

export const MTN_DEMO_ASSURANCE_COUNT_TARGETS = {
  operationalCohort: MTN_DEMO_ASSURANCE_PERSONAS.length,
  healthy: MTN_DEMO_ASSURANCE_PERSONAS.filter((p) => p.severity === 'HEALTHY').length,
  requireReview: MTN_DEMO_ASSURANCE_PERSONAS.filter((p) => p.severity === 'REVIEW').length,
  critical: MTN_DEMO_ASSURANCE_PERSONAS.filter((p) => p.severity === 'CRITICAL').length,
} as const;

export const GOVERNANCE_REVIEW_WORKSPACE_LABEL = 'Governance Review';

export const CONTINUOUS_WORKFORCE_ASSURANCE_DOCTRINE =
  'Continuous Workforce Assurance does not discover workers, reconcile identities, or provision access. ' +
  'It continuously evaluates whether operational workers remain compliant with workforce governance policy.';

export const ASSESSMENT_VS_ASSURANCE_DOCTRINE =
  'Assessment determines whether a worker is ready to become operational. ' +
  'Continuous Workforce Assurance determines whether an operational worker remains fit to stay operational.';

export const EWP_VALUE_PROPOSITION =
  'EWP continuously assures that operational external workers remain compliant across procurement, ' +
  'HR, workforce governance, and identity governance.';

export const LIFECYCLE_PLACEMENT_QUESTION =
  'Is this about becoming operational, or remaining operational?';

export const ONE_CAPABILITY_ONE_QUESTION_DOCTRINE =
  'Every capability exists to answer exactly one business question. When a capability begins answering multiple independent questions, ' +
  'it is a signal that a new capability may be emerging — not that the existing one should expand.';
