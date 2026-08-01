/**
 * Demo login personas — EWP product terminology (non-production seed only).
 * Keep in sync with frontend/lib/demo-login-personas.ts
 */
export const DEMO_EMAIL_DOMAIN = 'ewp.demo';

export const LEGACY_DEMO_EMAIL_DOMAIN = 'contractor-cms.com';

export function demoEmail(localPart: string): string {
  return `${localPart}@${DEMO_EMAIL_DOMAIN}`;
}

export type DemoLoginPersona = {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  /** Business audience label (not RBAC role name) */
  audienceLabel: string;
  experience: string;
};

export const DEMO_LOGIN_PERSONAS = {
  operationsAdmin: {
    id: 'operations-admin',
    email: demoEmail('ops.admin'),
    password: 'Admin123!',
    firstName: 'Operations',
    lastName: 'Admin',
    audienceLabel: 'Managing an External Workforce',
    experience: 'Operations console',
  },
  financeUser: {
    id: 'finance-user',
    email: demoEmail('finance'),
    password: 'Finance123!',
    firstName: 'Finance',
    lastName: 'Analyst',
    audienceLabel: 'Finance operations',
    experience: 'Operations console',
  },
  operationsManager: {
    id: 'operations-manager',
    email: demoEmail('ops.manager'),
    password: 'Manager123!',
    firstName: 'Operations',
    lastName: 'Manager',
    audienceLabel: 'Workforce & engagement management',
    experience: 'Operations console',
  },
  externalWorker: {
    id: 'external-worker',
    email: demoEmail('external.worker'),
    password: 'Contractor123!',
    firstName: 'Alex',
    lastName: 'Mokoena',
    audienceLabel: 'External worker self-service',
    experience: 'Timesheets',
  },
  supplierAdmin: {
    id: 'supplier-admin',
    email: demoEmail('supplier.admin'),
    password: 'SupplierAdmin123!',
    firstName: 'Supplier',
    lastName: 'Admin',
    audienceLabel: 'Working as a Supplier',
    experience: 'Supplier portal',
  },
  /** MTN story — one portal admin per supplier (membership bound after seed:mtn-demo-story) */
  mtnAtlasSupplierAdmin: {
    id: 'mtn-atlas-supplier-admin',
    email: 'supplier.admin@atlas.demo',
    password: 'SupplierAdmin123!',
    firstName: 'Atlas',
    lastName: 'Administrator',
    audienceLabel: 'Atlas Consulting — supplier portal',
    experience: 'Supplier portal',
  },
  mtnNexaSupplierAdmin: {
    id: 'mtn-nexa-supplier-admin',
    email: 'supplier.admin@nexa.demo',
    password: 'SupplierAdmin123!',
    firstName: 'Nexa',
    lastName: 'Administrator',
    audienceLabel: 'Nexa Technologies — supplier portal',
    experience: 'Supplier portal',
  },
  mtnUbuntuSupplierAdmin: {
    id: 'mtn-ubuntu-supplier-admin',
    email: 'supplier.admin@ubuntu.demo',
    password: 'SupplierAdmin123!',
    firstName: 'Ubuntu',
    lastName: 'Administrator',
    audienceLabel: 'Ubuntu Field Services — supplier portal',
    experience: 'Supplier portal',
  },
  mtnVertexSupplierAdmin: {
    id: 'mtn-vertex-supplier-admin',
    email: 'supplier.admin@vertex.demo',
    password: 'SupplierAdmin123!',
    firstName: 'Vertex',
    lastName: 'Administrator',
    audienceLabel: 'Vertex Projects — supplier portal',
    experience: 'Supplier portal',
  },
  mtnHorizonSupplierAdmin: {
    id: 'mtn-horizon-supplier-admin',
    email: 'supplier.admin@horizon.demo',
    password: 'SupplierAdmin123!',
    firstName: 'Horizon',
    lastName: 'Administrator',
    audienceLabel: 'Horizon Staffing — supplier portal',
    experience: 'Supplier portal',
  },
  supplierManager: {
    id: 'supplier-manager',
    email: demoEmail('supplier.manager'),
    password: 'SupplierManager123!',
    firstName: 'Supplier',
    lastName: 'Manager',
    audienceLabel: 'Supplier operations',
    experience: 'Supplier portal',
  },
  workforceImportAdmin: {
    id: 'workforce-import-admin',
    email: demoEmail('workforce.import'),
    password: 'GovOps123!',
    firstName: 'Workforce',
    lastName: 'Import',
    audienceLabel: 'Workforce Import & connector UAT',
    experience: 'Workforce Import (Oracle HCM)',
  },
  integrationOperator: {
    id: 'integration-operator',
    email: demoEmail('integration'),
    password: 'IntegrationOps123!',
    firstName: 'Integration',
    lastName: 'Operator',
    audienceLabel: 'Supplier sync operator',
    experience: 'Supplier sync',
  },
  supplierReviewer: {
    id: 'supplier-reviewer',
    email: demoEmail('supplier.reviewer'),
    password: 'SupplierReview123!',
    firstName: 'Supplier',
    lastName: 'Reviewer',
    audienceLabel: 'Supplier approvals',
    experience: 'Supplier governance',
  },
  governanceReviewer: {
    id: 'governance-reviewer',
    email: demoEmail('governance.reviewer'),
    password: 'GovReview123!',
    firstName: 'Governance',
    lastName: 'Reviewer',
    audienceLabel: 'Workforce governance review',
    experience: 'Workforce Import & governance',
  },
  engagementOps: {
    id: 'engagement-ops',
    email: demoEmail('engagement.ops'),
    password: 'ContractorOps123!',
    firstName: 'Engagement',
    lastName: 'Operations',
    audienceLabel: 'Engagement administration',
    experience: 'Operations console',
  },
  governanceViewer: {
    id: 'governance-viewer',
    email: demoEmail('governance.viewer'),
    password: 'GovView123!',
    firstName: 'Governance',
    lastName: 'Viewer',
    audienceLabel: 'Read-only governance',
    experience: 'Operations console (read-only)',
  },
  supplierPortalOperator: {
    id: 'supplier-portal-operator',
    email: demoEmail('supplier.portal'),
    password: 'SupplierPortal123!',
    firstName: 'Portal',
    lastName: 'Operator',
    audienceLabel: 'Supplier portal testing',
    experience: 'Supplier portal',
  },
  sponsorInbox: {
    id: 'sponsor-inbox',
    email: demoEmail('sponsor'),
    password: 'Sponsor123!',
    firstName: 'Business',
    lastName: 'Sponsor',
    audienceLabel: 'Sponsor accountability inbox',
    experience: 'Sponsor tasks (demo only)',
  },
} as const satisfies Record<string, DemoLoginPersona>;

/** Primary personas referenced in demo scripts and walkthroughs */
export const DEMO_PRIMARY = {
  operations: DEMO_LOGIN_PERSONAS.operationsAdmin,
  supplier: DEMO_LOGIN_PERSONAS.mtnAtlasSupplierAdmin,
  workforceImport: DEMO_LOGIN_PERSONAS.workforceImportAdmin,
} as const;

export const MTN_SUPPLIER_ADMIN_PERSONAS = [
  DEMO_LOGIN_PERSONAS.mtnAtlasSupplierAdmin,
  DEMO_LOGIN_PERSONAS.mtnNexaSupplierAdmin,
  DEMO_LOGIN_PERSONAS.mtnUbuntuSupplierAdmin,
  DEMO_LOGIN_PERSONAS.mtnVertexSupplierAdmin,
  DEMO_LOGIN_PERSONAS.mtnHorizonSupplierAdmin,
] as const;
