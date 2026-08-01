/**
 * Canonical named governance demo fixtures — use these IDs in UAT scripts and demos.
 * Seeded by `seed-governance-fixtures.ts` (idempotent).
 */

/** Supplier Oracle connector — external supplier IDs / drift anchors */
export const SUPPLIER_GOVERNANCE_FIXTURES = {
  /** Healthy sync — matched to Demo Supplier Ltd governance twin */
  HEALTHY_MATCHED: 'GOV-ORACLE-HEALTHY-001',
  /** Possible match — fuzzy reconciliation queue */
  POSSIBLE_MATCH: 'GOV-ORACLE-POSSIBLE-002',
  /** Duplicate external ID — HIGH drift, classified */
  DUPLICATE_EXTERNAL: 'GOV-ORACLE-DUP-003',
  /** Pending evidence + governance state conflict — CRITICAL */
  PENDING_EVIDENCE: 'GOV-ORACLE-PENDING-001',
  /** Stale connector / failed sync / checkpoint gap */
  STALE_CONNECTOR: 'GOV-ORACLE-STALE-004',
  /** Staging row in reconciliation conflict */
  RECONCILIATION_CONFLICT: 'GOV-ORACLE-RECON-005',
} as const;

/** Workforce Oracle HCM — source person IDs */
export const WORKFORCE_GOVERNANCE_FIXTURES = {
  /** Legacy seed flagship (HCM_ONLY lifecycle conflict). Live connector demo: HCM-WORKER-DEMO-008 unsponsored. */
  TERM_ACTIVE: 'HCM-TERM-ACTIVE-001',
  /** Identity / correlation conflict — MANUAL_REVIEW */
  IDENTITY_CONFLICT: 'HCM-CONFLICT-002',
  /** LOW confidence correlation */
  LOW_CONFIDENCE: 'HCM-LOWCONF-003',
  /** Missing supplier link drift */
  NO_SUPPLIER_LINK: 'HCM-NOSUP-004',
  /** Additional HIGH confidence matched worker (telemetry panels) */
  HIGH_CONFIDENCE: 'HCM-HIGHCONF-005',
} as const;

export const GOVERNANCE_FIXTURE_CATALOG = [
  {
    id: SUPPLIER_GOVERNANCE_FIXTURES.PENDING_EVIDENCE,
    domain: 'supplier',
    scenario: 'Pending evidence / governance state conflict',
    uiRoute: '/supplier-sources/oracle/operations',
  },
  {
    id: SUPPLIER_GOVERNANCE_FIXTURES.DUPLICATE_EXTERNAL,
    domain: 'supplier',
    scenario: 'Duplicate external ID',
    uiRoute: '/supplier-sources/oracle/operations',
  },
  {
    id: SUPPLIER_GOVERNANCE_FIXTURES.POSSIBLE_MATCH,
    domain: 'supplier',
    scenario: 'Possible match reconciliation',
    uiRoute: '/supplier-sources/oracle/operations',
  },
  {
    id: SUPPLIER_GOVERNANCE_FIXTURES.STALE_CONNECTOR,
    domain: 'supplier',
    scenario: 'Stale connector / failed sync',
    uiRoute: '/supplier-sources/oracle/operations',
  },
  {
    id: SUPPLIER_GOVERNANCE_FIXTURES.RECONCILIATION_CONFLICT,
    domain: 'supplier',
    scenario: 'Reconciliation conflict staging',
    uiRoute: '/supplier-sources/oracle/operations',
  },
  {
    id: WORKFORCE_GOVERNANCE_FIXTURES.TERM_ACTIVE,
    domain: 'workforce',
    scenario: 'Legacy HCM_ONLY lifecycle conflict (not connector demo flagship)',
    uiRoute: '/contractor-sources/oracle-hcm/operations',
    contractorEmail: 'fixture.hcm-term-active@demo.local',
  },
  {
    id: WORKFORCE_GOVERNANCE_FIXTURES.IDENTITY_CONFLICT,
    domain: 'workforce',
    scenario: 'Identity / correlation conflict',
    uiRoute: '/contractor-sources/oracle-hcm/operations',
  },
  {
    id: WORKFORCE_GOVERNANCE_FIXTURES.LOW_CONFIDENCE,
    domain: 'workforce',
    scenario: 'LOW confidence correlation',
    uiRoute: '/contractor-sources/oracle-hcm/operations',
    contractorEmail: 'fixture.hcm-lowconf@demo.local',
  },
  {
    id: WORKFORCE_GOVERNANCE_FIXTURES.NO_SUPPLIER_LINK,
    domain: 'workforce',
    scenario: 'Missing supplier link',
    uiRoute: '/contractor-sources/oracle-hcm/operations',
  },
] as const;
