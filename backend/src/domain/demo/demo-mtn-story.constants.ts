/**
 * MTN external workforce demo story — five believable suppliers, forty workers,
 * scoped supplier portal admins, framework contracts, and governance scenarios.
 *
 * Oracle fixtures and setup scripts derive from this file (single source of truth).
 */

import { MTN_DEMO_HCM_SUPPLIER_REFERENCES } from './demo-hcm-supplier-reference.constants';

export type MtnDemoSupplierScenario =
  | 'clean_supplier'
  | 'large_it_supplier'
  | 'field_operations'
  | 'project_delivery'
  | 'labour_broker';

export type MtnDemoWorkerScenario =
  | 'clean_high_confidence'
  | 'missing_supplier_link'
  | 'unsponsored_operational_governance'
  | 'manual_review_identity_conflict'
  | 'duplicate_hcm_person_conflict'
  | 'unlinked_worker'
  | 'hcm_supplier_reference_possible_match'
  | 'hcm_supplier_reference_conflict';

export type MtnDemoSupplierDefinition = {
  externalSupplierId: string;
  supplierNumber: string;
  companyName: string;
  tradingName: string;
  industry: string;
  region: string;
  contactPerson: string;
  contactEmail: string;
  logoSlug: string;
  taxRegistrationNumber: string;
  supplierType: string;
  portalAdminEmail: string;
  portalAdminPassword: string;
  portalAdminFirstName: string;
  portalAdminLastName: string;
  contractNumber: string;
  contractTitle: string;
  engagementTitle: string;
  scenario: MtnDemoSupplierScenario;
  workerCount: number;
};

export type MtnDemoWorkerDefinition = {
  personId: string;
  personNumber: string;
  displayName: string;
  email: string;
  supplierTradingName: string | null;
  supplierCompanyName: string | null;
  scenario: MtnDemoWorkerScenario;
};

export const MTN_DEMO_SUPPLIER_PORTAL_PASSWORD = 'SupplierAdmin123!';

export const MTN_DEMO_SUPPLIERS: MtnDemoSupplierDefinition[] = [
  {
    externalSupplierId: 'ORCL-SUP-MTN-001',
    supplierNumber: 'SUP-MTN-001',
    companyName: 'Atlas Consulting (Pty) Ltd',
    tradingName: 'Atlas Consulting',
    industry: 'Professional Services',
    region: 'Gauteng',
    contactPerson: 'Thandi Ndlovu',
    contactEmail: 'thandi.ndlovu@atlas.co.za',
    logoSlug: 'atlas',
    taxRegistrationNumber: 'ZA-MTN-ATLAS-001',
    supplierType: 'Professional Services',
    portalAdminEmail: 'supplier.admin@atlas.demo',
    portalAdminPassword: MTN_DEMO_SUPPLIER_PORTAL_PASSWORD,
    portalAdminFirstName: 'Atlas',
    portalAdminLastName: 'Administrator',
    contractNumber: 'MTN-FWA-001',
    contractTitle: 'Supplier Framework Agreement — Atlas Consulting',
    engagementTitle: 'Network Modernisation',
    scenario: 'clean_supplier',
    workerCount: 8,
  },
  {
    externalSupplierId: 'ORCL-SUP-MTN-002',
    supplierNumber: 'SUP-MTN-002',
    companyName: 'Nexa Technologies (Pty) Ltd',
    tradingName: 'Nexa Technologies',
    industry: 'IT Services',
    region: 'Gauteng',
    contactPerson: 'James Mthembu',
    contactEmail: 'james.mthembu@nexa.co.za',
    logoSlug: 'nexa',
    taxRegistrationNumber: 'ZA-MTN-NEXA-002',
    supplierType: 'IT Services',
    portalAdminEmail: 'supplier.admin@nexa.demo',
    portalAdminPassword: MTN_DEMO_SUPPLIER_PORTAL_PASSWORD,
    portalAdminFirstName: 'Nexa',
    portalAdminLastName: 'Administrator',
    contractNumber: 'MTN-FWA-002',
    contractTitle: 'Supplier Framework Agreement — Nexa Technologies',
    engagementTitle: 'OSS/BSS Transformation',
    scenario: 'large_it_supplier',
    workerCount: 10,
  },
  {
    externalSupplierId: 'ORCL-SUP-MTN-003',
    supplierNumber: 'SUP-MTN-003',
    companyName: 'Ubuntu Field Services (Pty) Ltd',
    tradingName: 'Ubuntu Field Services',
    industry: 'Field Operations',
    region: 'KwaZulu-Natal',
    contactPerson: 'Nomsa Dlamini',
    contactEmail: 'nomsa.dlamini@ubuntu.co.za',
    logoSlug: 'ubuntu',
    taxRegistrationNumber: 'ZA-MTN-UBUNTU-003',
    supplierType: 'Field Operations',
    portalAdminEmail: 'supplier.admin@ubuntu.demo',
    portalAdminPassword: MTN_DEMO_SUPPLIER_PORTAL_PASSWORD,
    portalAdminFirstName: 'Ubuntu',
    portalAdminLastName: 'Administrator',
    contractNumber: 'MTN-FWA-003',
    contractTitle: 'Supplier Framework Agreement — Ubuntu Field Services',
    engagementTitle: 'Regional Field Rollout',
    scenario: 'field_operations',
    workerCount: 6,
  },
  {
    externalSupplierId: 'ORCL-SUP-MTN-004',
    supplierNumber: 'SUP-MTN-004',
    companyName: 'Vertex Projects (Pty) Ltd',
    tradingName: 'Vertex Projects',
    industry: 'Project Delivery',
    region: 'Western Cape',
    contactPerson: 'Lauren Petersen',
    contactEmail: 'lauren.petersen@vertex.co.za',
    logoSlug: 'vertex',
    taxRegistrationNumber: 'ZA-MTN-VERTEX-004',
    supplierType: 'Project Delivery',
    portalAdminEmail: 'supplier.admin@vertex.demo',
    portalAdminPassword: MTN_DEMO_SUPPLIER_PORTAL_PASSWORD,
    portalAdminFirstName: 'Vertex',
    portalAdminLastName: 'Administrator',
    contractNumber: 'MTN-FWA-004',
    contractTitle: 'Supplier Framework Agreement — Vertex Projects',
    engagementTitle: 'Data Centre Migration',
    scenario: 'project_delivery',
    workerCount: 7,
  },
  {
    externalSupplierId: 'ORCL-SUP-MTN-005',
    supplierNumber: 'SUP-MTN-005',
    companyName: 'Horizon Staffing Solutions (Pty) Ltd',
    tradingName: 'Horizon Staffing',
    industry: 'Labour Broker',
    region: 'Gauteng',
    contactPerson: 'Samuel Daniels',
    contactEmail: 'samuel.daniels@horizon.co.za',
    logoSlug: 'horizon',
    taxRegistrationNumber: 'ZA-MTN-HORIZON-005',
    supplierType: 'Labour Broker',
    portalAdminEmail: 'supplier.admin@horizon.demo',
    portalAdminPassword: MTN_DEMO_SUPPLIER_PORTAL_PASSWORD,
    portalAdminFirstName: 'Horizon',
    portalAdminLastName: 'Administrator',
    contractNumber: 'MTN-FWA-005',
    contractTitle: 'Supplier Framework Agreement — Horizon Staffing',
    engagementTitle: 'Managed Contractor Pool',
    scenario: 'labour_broker',
    workerCount: 9,
  },
];

const WORKER_NAMES_BY_SUPPLIER: Record<string, string[]> = {
  'Atlas Consulting': [
    'John Smith',
    'Sarah Williams',
    'David Brown',
    'Emily Johnson',
    'Michael Adams',
    'Lisa Taylor',
    'Robert Wilson',
    'Anna Jacobs',
  ],
  'Nexa Technologies': [
    'James Miller',
    'Olivia Thomas',
    'Daniel Moore',
    'Sophia White',
    'Benjamin Harris',
    'Emma Martin',
    'Christopher Lewis',
    'Grace Walker',
    'Matthew Young',
    'Natalie King',
  ],
  'Ubuntu Field Services': [
    'Peter Nkosi',
    'Lebo Mokoena',
    'Thabo Dlamini',
    'Ayanda Khumalo',
    'Nomsa Zulu',
    'Sibusiso Ndlovu',
  ],
  'Vertex Projects': [
    'Andrew Peterson',
    'Megan Roberts',
    'Ryan Cooper',
    'Lauren Evans',
    'Jason Parker',
    'Melissa Green',
    'Kyle Brooks',
  ],
  'Horizon Staffing': [
    'Samuel Daniels',
    'Rachel Morris',
    'Kevin Scott',
    'Nicole Bennett',
    'Brandon Reed',
    'Chloe Turner',
    'Justin Bell',
    'Amy Collins',
    'Nathan Price',
  ],
};

/** Scenario assignments — totals: 32 clean, 1 missing supplier, 2 HCM supplier refs, 2 unsponsored, 1 duplicate, 2 manual review */
const SCENARIO_OVERRIDES: Record<string, MtnDemoWorkerScenario> = {
  'Emma Martin': 'hcm_supplier_reference_conflict',
  'Jason Parker': 'missing_supplier_link',
  'Natalie King': 'unsponsored_operational_governance',
  'Matthew Young': 'duplicate_hcm_person_conflict',
  'Sibusiso Ndlovu': 'manual_review_identity_conflict',
  'Kyle Brooks': 'unsponsored_operational_governance',
  'Nathan Price': 'hcm_supplier_reference_possible_match',
};

function slugEmail(displayName: string, supplierSlug: string): string {
  const parts = displayName.trim().toLowerCase().split(/\s+/);
  const local = parts.join('.');
  return `${local}@${supplierSlug}.workers.demo`;
}

function buildWorkers(): MtnDemoWorkerDefinition[] {
  const workers: MtnDemoWorkerDefinition[] = [];
  let sequence = 1;

  for (const supplier of MTN_DEMO_SUPPLIERS) {
    const names = WORKER_NAMES_BY_SUPPLIER[supplier.tradingName] ?? [];
    for (const displayName of names) {
      const personId = `HCM-WORKER-MTN-${String(sequence).padStart(3, '0')}`;
      const scenario = SCENARIO_OVERRIDES[displayName] ?? 'clean_high_confidence';
      const isMissingSupplier = scenario === 'missing_supplier_link';
      const possibleMatchRef = MTN_DEMO_HCM_SUPPLIER_REFERENCES.find(
        (r) => r.reconciliationKind === 'POSSIBLE_MATCH',
      )!;
      const conflictRef = MTN_DEMO_HCM_SUPPLIER_REFERENCES.find(
        (r) => r.reconciliationKind === 'CONFLICT',
      )!;

      let supplierTradingName: string | null;
      let supplierCompanyName: string | null;

      if (isMissingSupplier) {
        supplierTradingName = null;
        supplierCompanyName = null;
      } else if (scenario === 'hcm_supplier_reference_possible_match') {
        supplierTradingName = possibleMatchRef.referenceName;
        supplierCompanyName = possibleMatchRef.referenceName;
      } else if (scenario === 'hcm_supplier_reference_conflict') {
        supplierTradingName = conflictRef.referenceName;
        supplierCompanyName = conflictRef.referenceName;
      } else if (scenario === 'unlinked_worker') {
        supplierTradingName = 'Unknown Labour Partner';
        supplierCompanyName = 'Unknown Labour Partner (Pty) Ltd';
      } else {
        supplierTradingName = supplier.tradingName;
        supplierCompanyName = supplier.companyName;
      }

      workers.push({
        personId,
        personNumber: `PN-MTN-${String(sequence).padStart(3, '0')}`,
        displayName,
        email: slugEmail(displayName, supplier.logoSlug),
        supplierTradingName,
        supplierCompanyName,
        scenario,
      });
      sequence += 1;
    }
  }

  return workers;
}

export const MTN_DEMO_WORKERS: MtnDemoWorkerDefinition[] = buildWorkers();

export const MTN_DEMO_WORKER_COUNT = MTN_DEMO_WORKERS.length;
export const MTN_DEMO_SUPPLIER_COUNT = MTN_DEMO_SUPPLIERS.length;

export const MTN_DEMO_GOVERNANCE_TARGETS = {
  operationallyReady: 32,
  missingSupplierLink: 2,
  /** Canonical: missing internal accountability (legacy telemetry: unsponsored) */
  missingInternalAccountability: 2,
  duplicateWorker: 1,
  manualReview: 2,
  unlinked: 1,
} as const;

export const MTN_DEMO_RESPONSIBLE_MANAGER_EMPLOYEE_ID = 'cms:emp:responsible-manager-demo';

/** @deprecated use MTN_DEMO_RESPONSIBLE_MANAGER_EMPLOYEE_ID */
export const MTN_DEMO_SPONSOR_EMPLOYEE_ID = MTN_DEMO_RESPONSIBLE_MANAGER_EMPLOYEE_ID;

export const MTN_DEMO_CONTRACT_START = new Date('2026-01-01T00:00:00.000Z');
export const MTN_DEMO_CONTRACT_END = new Date('2027-12-31T23:59:59.999Z');

/** Legacy demo supplier id retained for Atlas (primary happy-path promote button). */
export const DEMO_CLEAN_SUPPLIER_EXTERNAL_ID = MTN_DEMO_SUPPLIERS[0].externalSupplierId;

export function mtnSupplierByExternalId(externalSupplierId: string): MtnDemoSupplierDefinition | undefined {
  return MTN_DEMO_SUPPLIERS.find((s) => s.externalSupplierId === externalSupplierId);
}

export function mtnSupplierByTradingName(tradingName: string): MtnDemoSupplierDefinition | undefined {
  return MTN_DEMO_SUPPLIERS.find((s) => s.tradingName === tradingName);
}

/** Staging-only scenarios — findings stay on Workforce Discovery until resolved */
export const MTN_DEMO_SKIP_MATERIALIZE_SCENARIOS = new Set<MtnDemoWorkerScenario>([
  'duplicate_hcm_person_conflict',
  'manual_review_identity_conflict',
  'missing_supplier_link',
  'unlinked_worker',
]);

export function extractDemoWorkerScenarioFromPayload(
  sourcePayload: unknown,
): MtnDemoWorkerScenario | null {
  if (!sourcePayload || typeof sourcePayload !== 'object' || Array.isArray(sourcePayload)) {
    return null;
  }
  const payload = sourcePayload as Record<string, unknown>;
  const oracleRest = payload._oracleRest;
  if (oracleRest && typeof oracleRest === 'object' && !Array.isArray(oracleRest)) {
    const scenario = (oracleRest as Record<string, unknown>).scenario;
    if (typeof scenario === 'string' && scenario.trim()) {
      return scenario.trim() as MtnDemoWorkerScenario;
    }
  }
  const direct = payload.scenario;
  return typeof direct === 'string' && direct.trim()
    ? (direct.trim() as MtnDemoWorkerScenario)
    : null;
}
