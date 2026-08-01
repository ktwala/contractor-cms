/**
 * Demo login personas — EWP product terminology (non-production).
 * Keep in sync with backend/prisma/demo-login-credentials.ts
 */
export const DEMO_EMAIL_DOMAIN = 'ewp.demo';

export function demoEmail(localPart: string): string {
  return `${localPart}@${DEMO_EMAIL_DOMAIN}`;
}

export type DemoLoginPersona = {
  id: string;
  email: string;
  password: string;
  audienceLabel: string;
  experience: string;
};

export const DEMO_LOGIN_PERSONAS: DemoLoginPersona[] = [
  {
    id: 'operations-admin',
    email: demoEmail('ops.admin'),
    password: 'Admin123!',
    audienceLabel: 'Managing an External Workforce',
    experience: 'Operations console',
  },
  {
    id: 'supplier-admin',
    email: demoEmail('supplier.admin'),
    password: 'SupplierAdmin123!',
    audienceLabel: 'Working as a Supplier (legacy)',
    experience: 'Supplier portal',
  },
  {
    id: 'mtn-atlas-supplier-admin',
    email: 'supplier.admin@atlas.demo',
    password: 'SupplierAdmin123!',
    audienceLabel: 'Atlas Consulting — supplier portal',
    experience: 'Supplier portal',
  },
  {
    id: 'mtn-nexa-supplier-admin',
    email: 'supplier.admin@nexa.demo',
    password: 'SupplierAdmin123!',
    audienceLabel: 'Nexa Technologies — supplier portal',
    experience: 'Supplier portal',
  },
  {
    id: 'mtn-ubuntu-supplier-admin',
    email: 'supplier.admin@ubuntu.demo',
    password: 'SupplierAdmin123!',
    audienceLabel: 'Ubuntu Field Services — supplier portal',
    experience: 'Supplier portal',
  },
  {
    id: 'mtn-vertex-supplier-admin',
    email: 'supplier.admin@vertex.demo',
    password: 'SupplierAdmin123!',
    audienceLabel: 'Vertex Projects — supplier portal',
    experience: 'Supplier portal',
  },
  {
    id: 'mtn-horizon-supplier-admin',
    email: 'supplier.admin@horizon.demo',
    password: 'SupplierAdmin123!',
    audienceLabel: 'Horizon Staffing — supplier portal',
    experience: 'Supplier portal',
  },
  {
    id: 'workforce-import-admin',
    email: demoEmail('workforce.import'),
    password: 'GovOps123!',
    audienceLabel: 'Workforce Import & connector UAT',
    experience: 'Workforce Discovery (Oracle HCM)',
  },
  {
    id: 'finance-user',
    email: demoEmail('finance'),
    password: 'Finance123!',
    audienceLabel: 'Finance operations',
    experience: 'Operations console',
  },
  {
    id: 'operations-manager',
    email: demoEmail('ops.manager'),
    password: 'Manager123!',
    audienceLabel: 'Workforce & engagement management',
    experience: 'Operations console',
  },
  {
    id: 'external-worker',
    email: demoEmail('external.worker'),
    password: 'Contractor123!',
    audienceLabel: 'External worker self-service',
    experience: 'Timesheets',
  },
  {
    id: 'supplier-manager',
    email: demoEmail('supplier.manager'),
    password: 'SupplierManager123!',
    audienceLabel: 'Supplier operations',
    experience: 'Supplier portal',
  },
];

export const DEMO_PRIMARY_LOGINS = {
  operations: DEMO_LOGIN_PERSONAS[0],
  supplier: DEMO_LOGIN_PERSONAS.find((p) => p.id === 'mtn-atlas-supplier-admin')!,
  workforceImport: DEMO_LOGIN_PERSONAS.find((p) => p.id === 'workforce-import-admin')!,
} as const;
