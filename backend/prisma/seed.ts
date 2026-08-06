import {
  PrismaClient,
  UserType,
  SupplierType,
  ContractType,
  ContractorPersonType,
  ContractorAccessIntent,
  GovernanceRiskTier,
  WorkerArchetypeKind,
  ResponsibleManagerAccountabilityStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';
import {
  isKnownPermission,
  isValidPermissionFormat,
} from '../src/core/auth/permissions.constants';
import {
  SEED_TARGET_ROLE_PERMISSIONS,
  FINANCE_ADMIN_PERMISSIONS,
  GOVERNANCE_AUDITOR_PERMISSIONS,
  GOVERNANCE_INTEGRATION_OPERATOR_PERMISSIONS,
  GOVERNANCE_OPERATIONS_ADMIN_PERMISSIONS,
  GOVERNANCE_REVIEWER_PERMISSIONS,
  CONTRACTOR_MANAGER_PERMISSIONS,
  CONTRACTOR_OPERATIONS_USER_PERMISSIONS,
  GOVERNANCE_VIEWER_PERMISSIONS,
  SUPPLIER_GOVERNANCE_REVIEWER_PERMISSIONS,
} from '../src/core/auth/seed-system-role-bundles';
import { seedGovernanceFixtures } from './seed-governance-fixtures';
import { DEMO_CLIENT_CONTRACTOR_AUTHORITY_MODE } from '../src/core/authority/authority.constants';
import { DEMO_LOGIN_PERSONAS, LEGACY_DEMO_EMAIL_DOMAIN, MTN_SUPPLIER_ADMIN_PERSONAS } from './demo-login-credentials';

const prisma = new PrismaClient();

/**
 * Demo HCM employee ref for sponsor@ — matches engagement.responsibleManagerEmployeeId.
 * NON-PRODUCTION: real sponsors use internal users provisioned from HCM (PR-HCM-SPONSOR-USERS-1).
 */
const DEMO_SPONSOR_HCM_EMPLOYEE_ID = 'ewp:emp:responsible-manager-demo';

/** PR-SPONSOR-REFERENCE-ONLY-1 — demo sponsor login only when responsible-manager inbox is explicitly enabled. */
const SPONSOR_INBOX_ENABLED =
  process.env.RESPONSIBLE_MANAGER_ACCOUNTABILITY_INBOX_ENABLED === 'true';

/**
 * Legacy visible suppliers/contractors for scope/isolation tests.
 * Connector demos default to platform seed + `reset:connector-demo` (empty registry).
 */
const SEED_DEMO_OPERATIONAL_DATA = process.env.SEED_DEMO_OPERATIONAL_DATA === 'true';

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

async function main() {
  console.log('🌱 Seeding database...');

  const retiredLegacyUsers = await prisma.user.updateMany({
    where: { email: { endsWith: `@${LEGACY_DEMO_EMAIL_DOMAIN}` } },
    data: { isActive: false },
  });
  if (retiredLegacyUsers.count > 0) {
    console.log(
      `⏭️  Deactivated ${retiredLegacyUsers.count} legacy @${LEGACY_DEMO_EMAIL_DOMAIN} demo user(s)`,
    );
  }

  // Create default roles
  console.log('Creating default roles...');

  const platformAdminRole = await prisma.role.upsert({
    where: { name: 'CMS_ADMIN' },
    update: {},
    create: {
      name: 'CMS_ADMIN',
      description: 'Platform Administrator with full access',
      permissions: ['*:*'], // All permissions
      isSystemRole: true,
    },
  });

  const financeUserPermissions = [...FINANCE_ADMIN_PERMISSIONS];

  const financeUserRole = await prisma.role.upsert({
    where: { name: 'FINANCE_USER' },
    update: { permissions: financeUserPermissions },
    create: {
      name: 'FINANCE_USER',
      description: 'Finance and AP user',
      permissions: financeUserPermissions,
      isSystemRole: true,
    },
  });

  const contractorManagerPermissions = [...CONTRACTOR_MANAGER_PERMISSIONS];

  const contractorManagerRole = await prisma.role.upsert({
    where: { name: 'CONTRACTOR_MANAGER' },
    update: {
      description:
        'External Workforce Platform contractor operational authority — registry, engagements, remediation (no supplier sync/approve, no HCM bootstrap)',
      permissions: contractorManagerPermissions,
    },
    create: {
      name: 'CONTRACTOR_MANAGER',
      description:
        'External Workforce Platform contractor operational authority — registry, engagements, remediation (no supplier sync/approve, no HCM bootstrap)',
      permissions: contractorManagerPermissions,
      isSystemRole: true,
    },
  });

  const governanceIntegrationOperatorRole = await prisma.role.upsert({
    where: { name: 'GOVERNANCE_INTEGRATION_OPERATOR' },
    update: { permissions: [...GOVERNANCE_INTEGRATION_OPERATOR_PERMISSIONS] },
    create: {
      name: 'GOVERNANCE_INTEGRATION_OPERATOR',
      description:
        'Oracle supplier sync + HCM contractor bootstrap — ingestion only (no trust approvals, no platform contractor administration)',
      permissions: [...GOVERNANCE_INTEGRATION_OPERATOR_PERMISSIONS],
      isSystemRole: true,
    },
  });

  const supplierGovernanceReviewerRole = await prisma.role.upsert({
    where: { name: 'SUPPLIER_GOVERNANCE_REVIEWER' },
    update: { permissions: [...SUPPLIER_GOVERNANCE_REVIEWER_PERMISSIONS] },
    create: {
      name: 'SUPPLIER_GOVERNANCE_REVIEWER',
      description:
        'Supplier operational trust — approve/suspend only (no Oracle sync, no contractor bootstrap)',
      permissions: [...SUPPLIER_GOVERNANCE_REVIEWER_PERMISSIONS],
      isSystemRole: true,
    },
  });

  const contractorRole = await prisma.role.upsert({
    where: { name: 'CONTRACTOR' },
    update: {
      description: 'External worker self-service (no org-wide financial reads)',
      permissions: [
        'timesheets:create',
        'timesheets:read',
        'timesheets:update',
        'profile:read',
        'profile:update',
      ],
    },
    create: {
      name: 'CONTRACTOR',
      description: 'External worker self-service (no org-wide financial reads)',
      permissions: [
        'timesheets:create',
        'timesheets:read',
        'timesheets:update',
        'profile:read',
        'profile:update',
      ],
      isSystemRole: true,
    },
  });

  // PR-RBAC-REALIGN-1 / PR-RBAC-REALIGN-2 — target persona bundles (canonical arrays in seed-system-role-bundles.ts)
  const supplierAdminPerms = [...SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_ADMIN];
  const supplierManagerPerms = [...SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_MANAGER];
  const sponsorPerms = [...SEED_TARGET_ROLE_PERMISSIONS.SPONSOR];

  const supplierAdminRole = await prisma.role.upsert({
    where: { name: 'SUPPLIER_ADMIN' },
    update: {
      description:
        'Supplier portal admin — profile, users, documents, onboarding, contractors (membership-scoped)',
      permissions: supplierAdminPerms,
    },
    create: {
      name: 'SUPPLIER_ADMIN',
      description:
        'Supplier portal admin — profile, users, documents, onboarding, contractors (membership-scoped)',
      permissions: supplierAdminPerms,
      isSystemRole: true,
    },
  });

  const supplierManagerRole = await prisma.role.upsert({
    where: { name: 'SUPPLIER_MANAGER' },
    update: {
      description:
        'Supplier portal operations — contractors, timesheets, invoice visibility (no profile/users admin)',
      permissions: supplierManagerPerms,
    },
    create: {
      name: 'SUPPLIER_MANAGER',
      description:
        'Supplier portal operations — contractors, timesheets, invoice visibility (no profile/users admin)',
      permissions: supplierManagerPerms,
      isSystemRole: true,
    },
  });

  const governanceAuditorRole = await prisma.role.upsert({
    where: { name: 'GOVERNANCE_AUDITOR' },
    update: { permissions: [...GOVERNANCE_AUDITOR_PERMISSIONS] },
    create: {
      name: 'GOVERNANCE_AUDITOR',
      description: 'Read-only governance, audit, and exception evidence',
      permissions: [...GOVERNANCE_AUDITOR_PERMISSIONS],
      isSystemRole: true,
    },
  });

  const governanceOpsRole = await prisma.role.upsert({
    where: { name: 'GOVERNANCE_OPERATIONS_ADMIN' },
    update: {
      permissions: [...GOVERNANCE_OPERATIONS_ADMIN_PERMISSIONS],
      description:
        'DEMO ONLY — UAT composite (integration + supplier reviewer + contractor manager). Not a production role template.',
    },
    create: {
      name: 'GOVERNANCE_OPERATIONS_ADMIN',
      description:
        'DEMO ONLY — UAT composite (integration + supplier reviewer + contractor manager). Not a production role template.',
      permissions: [...GOVERNANCE_OPERATIONS_ADMIN_PERMISSIONS],
      isSystemRole: true,
    },
  });

  const governanceReviewerRole = await prisma.role.upsert({
    where: { name: 'GOVERNANCE_REVIEWER' },
    update: { permissions: [...GOVERNANCE_REVIEWER_PERMISSIONS] },
    create: {
      name: 'GOVERNANCE_REVIEWER',
      description: 'Human workflow tester — drift review and remediation lifecycle',
      permissions: [...GOVERNANCE_REVIEWER_PERMISSIONS],
      isSystemRole: true,
    },
  });

  const contractorOpsRole = await prisma.role.upsert({
    where: { name: 'CONTRACTOR_OPERATIONS_USER' },
    update: { permissions: [...CONTRACTOR_OPERATIONS_USER_PERMISSIONS] },
    create: {
      name: 'CONTRACTOR_OPERATIONS_USER',
      description: 'Workforce governance operator — contractors and remediation visibility',
      permissions: [...CONTRACTOR_OPERATIONS_USER_PERMISSIONS],
      isSystemRole: true,
    },
  });

  const governanceViewerRole = await prisma.role.upsert({
    where: { name: 'GOVERNANCE_VIEWER' },
    update: { permissions: [...GOVERNANCE_VIEWER_PERMISSIONS] },
    create: {
      name: 'GOVERNANCE_VIEWER',
      description: 'Read-only governance viewer — catches partial UI / hidden control bugs',
      permissions: [...GOVERNANCE_VIEWER_PERMISSIONS],
      isSystemRole: true,
    },
  });

  const sponsorRole = await prisma.role.upsert({
    where: { name: 'SPONSOR' },
    update: {
      description:
        'Client-side business sponsor (internal HCM employee accountability owner; demo login is test scaffolding only)',
      permissions: sponsorPerms,
    },
    create: {
      name: 'SPONSOR',
      description:
        'Client-side business sponsor (internal HCM employee accountability owner; demo login is test scaffolding only)',
      permissions: sponsorPerms,
      isSystemRole: true,
    },
  });

  // Validate all seeded permissions against the canonical catalog
  const seededRoles = [
    { name: 'CMS_ADMIN', permissions: platformAdminRole.permissions },
    { name: 'FINANCE_USER', permissions: financeUserRole.permissions },
    { name: 'CONTRACTOR_MANAGER', permissions: contractorManagerRole.permissions },
    {
      name: 'GOVERNANCE_INTEGRATION_OPERATOR',
      permissions: governanceIntegrationOperatorRole.permissions,
    },
    {
      name: 'SUPPLIER_GOVERNANCE_REVIEWER',
      permissions: supplierGovernanceReviewerRole.permissions,
    },
    { name: 'CONTRACTOR', permissions: contractorRole.permissions },
    { name: 'SUPPLIER_ADMIN', permissions: supplierAdminRole.permissions },
    { name: 'SUPPLIER_MANAGER', permissions: supplierManagerRole.permissions },
    { name: 'SPONSOR', permissions: sponsorRole.permissions },
    { name: 'GOVERNANCE_AUDITOR', permissions: governanceAuditorRole.permissions },
    {
      name: 'GOVERNANCE_OPERATIONS_ADMIN',
      permissions: governanceOpsRole.permissions,
    },
    { name: 'GOVERNANCE_REVIEWER', permissions: governanceReviewerRole.permissions },
    {
      name: 'CONTRACTOR_OPERATIONS_USER',
      permissions: contractorOpsRole.permissions,
    },
    { name: 'GOVERNANCE_VIEWER', permissions: governanceViewerRole.permissions },
  ];

  for (const role of seededRoles) {
    for (const perm of role.permissions) {
      if (!isValidPermissionFormat(perm)) {
        throw new Error(
          `Seed error: malformed permission "${perm}" in role "${role.name}". ` +
          `Expected format: resource:action`,
        );
      }
      if (!isKnownPermission(perm)) {
        throw new Error(
          `Seed error: unknown permission "${perm}" in role "${role.name}". ` +
          `Add it to permissions.constants.ts or fix the typo.`,
        );
      }
    }
  }

  console.log(`✅ Created ${seededRoles.length} system roles (all permissions validated against catalog)`);

  // Create demo organization
  console.log('Creating demo organization...');

  const demoOrg = await prisma.organization.upsert({
    where: { code: 'DEMO' },
    update: {
      supplierAuthorityMode: 'ORACLE_ONLY',
      contractorAuthorityMode: DEMO_CLIENT_CONTRACTOR_AUTHORITY_MODE,
      hcmType: 'ORACLE_HCM',
    },
    create: {
      name: 'Demo Organization',
      code: 'DEMO',
      country: 'ZA',
      currency: 'ZAR',
      timezone: 'Africa/Johannesburg',
      hcmType: 'ORACLE_HCM',
      hcmConfig: {
        natsUrl: 'nats://localhost:4222',
        subject: 'hcm.withholding',
      },
      supplierAuthorityMode: 'ORACLE_ONLY',
      contractorAuthorityMode: DEMO_CLIENT_CONTRACTOR_AUTHORITY_MODE,
      isActive: true,
    },
  });

  console.log(`✅ Created organization: ${demoOrg.name}`);

  // Create admin user
  console.log('Creating admin user...');

  const opsAdmin = DEMO_LOGIN_PERSONAS.operationsAdmin;
  const adminPasswordHash = await hashPassword(opsAdmin.password);
  const adminUser = await prisma.user.upsert({
    where: { email: opsAdmin.email },
    update: {
      organizationId: demoOrg.id,
      firstName: opsAdmin.firstName,
      lastName: opsAdmin.lastName,
      isActive: true,
    },
    create: {
      email: opsAdmin.email,
      passwordHash: adminPasswordHash,
      firstName: opsAdmin.firstName,
      lastName: opsAdmin.lastName,
      userType: UserType.INTERNAL,
      organizationId: demoOrg.id,
      isActive: true,
      emailVerified: true,
    },
  });

  // PR-SEED-ROLE-DUPE-1 — single global CMS_ADMIN assignment (null = platform-wide)
  await prisma.userRole.deleteMany({
    where: { userId: adminUser.id, roleId: platformAdminRole.id },
  });
  await prisma.userRole.create({
    data: {
      userId: adminUser.id,
      roleId: platformAdminRole.id,
      organizationId: null,
      assignedBy: 'system',
    },
  });

  console.log(`✅ Created admin user: ${adminUser.email}`);
  console.log(`   Password: ${opsAdmin.password}`);
  console.log(`   Experience: ${opsAdmin.experience}`);

  // Create finance user
  console.log('Creating finance user...');

  const financePersona = DEMO_LOGIN_PERSONAS.financeUser;
  const financePasswordHash = await hashPassword(financePersona.password);

  const financeUser = await prisma.user.upsert({
    where: { email: financePersona.email },
    update: {
      firstName: financePersona.firstName,
      lastName: financePersona.lastName,
      isActive: true,
    },
    create: {
      email: financePersona.email,
      passwordHash: financePasswordHash,
      firstName: financePersona.firstName,
      lastName: financePersona.lastName,
      userType: UserType.INTERNAL,
      organizationId: demoOrg.id,
      isActive: true,
      emailVerified: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId_organizationId: {
        userId: financeUser.id,
        roleId: financeUserRole.id,
        organizationId: demoOrg.id,
      },
    },
    update: {},
    create: {
      userId: financeUser.id,
      roleId: financeUserRole.id,
      organizationId: demoOrg.id,
      assignedBy: adminUser.id,
    },
  });

  console.log(`✅ Created finance user: ${financeUser.email}`);
  console.log(`   Password: ${financePersona.password}`);

  // Demo CONTRACTOR_MANAGER (persona smoke)
  const managerPersona = DEMO_LOGIN_PERSONAS.operationsManager;
  const managerPasswordHash = await hashPassword(managerPersona.password);
  const managerUser = await prisma.user.upsert({
    where: { email: managerPersona.email },
    update: {
      firstName: managerPersona.firstName,
      lastName: managerPersona.lastName,
      isActive: true,
    },
    create: {
      email: managerPersona.email,
      passwordHash: managerPasswordHash,
      firstName: managerPersona.firstName,
      lastName: managerPersona.lastName,
      userType: UserType.INTERNAL,
      organizationId: demoOrg.id,
      isActive: true,
      emailVerified: true,
    },
  });
  await prisma.userRole.upsert({
    where: {
      userId_roleId_organizationId: {
        userId: managerUser.id,
        roleId: contractorManagerRole.id,
        organizationId: demoOrg.id,
      },
    },
    update: {},
    create: {
      userId: managerUser.id,
      roleId: contractorManagerRole.id,
      organizationId: demoOrg.id,
      assignedBy: adminUser.id,
    },
  });
  console.log(`✅ Created contractor manager: ${managerUser.email}`);
  console.log(`   Password: ${managerPersona.password}`);

  // Demo CONTRACTOR (persona smoke — timesheets only in nav)
  const workerPersona = DEMO_LOGIN_PERSONAS.externalWorker;
  const contractorPasswordHash = await hashPassword(workerPersona.password);
  const contractorLoginUser = await prisma.user.upsert({
    where: { email: workerPersona.email },
    update: {
      firstName: workerPersona.firstName,
      lastName: workerPersona.lastName,
      isActive: true,
    },
    create: {
      email: workerPersona.email,
      passwordHash: contractorPasswordHash,
      firstName: workerPersona.firstName,
      lastName: workerPersona.lastName,
      userType: UserType.CONTRACTOR,
      organizationId: demoOrg.id,
      isActive: true,
      emailVerified: true,
    },
  });
  await prisma.userRole.upsert({
    where: {
      userId_roleId_organizationId: {
        userId: contractorLoginUser.id,
        roleId: contractorRole.id,
        organizationId: demoOrg.id,
      },
    },
    update: {},
    create: {
      userId: contractorLoginUser.id,
      roleId: contractorRole.id,
      organizationId: demoOrg.id,
      assignedBy: adminUser.id,
    },
  });
  console.log(`✅ Created external worker login: ${contractorLoginUser.email}`);
  console.log(`   Password: ${workerPersona.password}`);

  // PR-SEED-PERSONA-USERS-1 — target doctrine personas (existing role bundles only; smoke / regression)
  const supplierAdminPersona = DEMO_LOGIN_PERSONAS.supplierAdmin;
  const supplierAdminPasswordHash = await hashPassword(supplierAdminPersona.password);
  const supplierAdminUser = await prisma.user.upsert({
    where: { email: supplierAdminPersona.email },
    update: {
      firstName: supplierAdminPersona.firstName,
      lastName: supplierAdminPersona.lastName,
      isActive: true,
    },
    create: {
      email: supplierAdminPersona.email,
      passwordHash: supplierAdminPasswordHash,
      firstName: supplierAdminPersona.firstName,
      lastName: supplierAdminPersona.lastName,
      userType: UserType.INTERNAL,
      organizationId: demoOrg.id,
      isActive: true,
      emailVerified: true,
    },
  });
  await prisma.userRole.upsert({
    where: {
      userId_roleId_organizationId: {
        userId: supplierAdminUser.id,
        roleId: supplierAdminRole.id,
        organizationId: demoOrg.id,
      },
    },
    update: {},
    create: {
      userId: supplierAdminUser.id,
      roleId: supplierAdminRole.id,
      organizationId: demoOrg.id,
      assignedBy: adminUser.id,
    },
  });
  console.log(`✅ Created supplier admin: ${supplierAdminUser.email}`);
  console.log(`   Password: ${supplierAdminPersona.password}`);

  for (const persona of MTN_SUPPLIER_ADMIN_PERSONAS) {
    const passwordHash = await hashPassword(persona.password);
    const user = await prisma.user.upsert({
      where: { email: persona.email },
      update: {
        firstName: persona.firstName,
        lastName: persona.lastName,
        isActive: true,
      },
      create: {
        email: persona.email,
        passwordHash,
        firstName: persona.firstName,
        lastName: persona.lastName,
        userType: UserType.INTERNAL,
        organizationId: demoOrg.id,
        isActive: true,
        emailVerified: true,
      },
    });
    await prisma.userRole.upsert({
      where: {
        userId_roleId_organizationId: {
          userId: user.id,
          roleId: supplierAdminRole.id,
          organizationId: demoOrg.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: supplierAdminRole.id,
        organizationId: demoOrg.id,
        assignedBy: adminUser.id,
      },
    });
    console.log(`✅ Created MTN supplier portal admin: ${user.email}`);
  }

  const supplierManagerPersona = DEMO_LOGIN_PERSONAS.supplierManager;
  const supplierManagerPasswordHash = await hashPassword(supplierManagerPersona.password);
  const supplierManagerUser = await prisma.user.upsert({
    where: { email: supplierManagerPersona.email },
    update: {
      firstName: supplierManagerPersona.firstName,
      lastName: supplierManagerPersona.lastName,
      isActive: true,
    },
    create: {
      email: supplierManagerPersona.email,
      passwordHash: supplierManagerPasswordHash,
      firstName: supplierManagerPersona.firstName,
      lastName: supplierManagerPersona.lastName,
      userType: UserType.INTERNAL,
      organizationId: demoOrg.id,
      isActive: true,
      emailVerified: true,
    },
  });
  await prisma.userRole.upsert({
    where: {
      userId_roleId_organizationId: {
        userId: supplierManagerUser.id,
        roleId: supplierManagerRole.id,
        organizationId: demoOrg.id,
      },
    },
    update: {},
    create: {
      userId: supplierManagerUser.id,
      roleId: supplierManagerRole.id,
      organizationId: demoOrg.id,
      assignedBy: adminUser.id,
    },
  });
  console.log(`✅ Created supplier manager: ${supplierManagerUser.email}`);
  console.log(`   Password: ${supplierManagerPersona.password}`);

  if (SPONSOR_INBOX_ENABLED) {
    const sponsorPersona = DEMO_LOGIN_PERSONAS.sponsorInbox;
    const sponsorPasswordHash = await hashPassword(sponsorPersona.password);
    const sponsorUser = await prisma.user.upsert({
      where: { email: sponsorPersona.email },
      update: {
        externalId: DEMO_SPONSOR_HCM_EMPLOYEE_ID,
        externalProvider: 'HCM',
        firstName: sponsorPersona.firstName,
        lastName: sponsorPersona.lastName,
        isActive: true,
      },
      create: {
        email: sponsorPersona.email,
        passwordHash: sponsorPasswordHash,
        firstName: sponsorPersona.firstName,
        lastName: sponsorPersona.lastName,
        userType: UserType.INTERNAL,
        externalId: DEMO_SPONSOR_HCM_EMPLOYEE_ID,
        externalProvider: 'HCM',
        organizationId: demoOrg.id,
        isActive: true,
        emailVerified: true,
      },
    });
    await prisma.userRole.upsert({
      where: {
        userId_roleId_organizationId: {
          userId: sponsorUser.id,
          roleId: sponsorRole.id,
          organizationId: demoOrg.id,
        },
      },
      update: {},
      create: {
        userId: sponsorUser.id,
        roleId: sponsorRole.id,
        organizationId: demoOrg.id,
        assignedBy: adminUser.id,
      },
    });
    console.log(`✅ Created business sponsor (demo/test): ${sponsorUser.email}`);
    console.log(`   Password: ${sponsorPersona.password}`);
    console.log(`   HCM employee ref: ${DEMO_SPONSOR_HCM_EMPLOYEE_ID}`);
  } else {
    console.log(
      '⏭️  Skipped sponsor@ demo user (set RESPONSIBLE_MANAGER_ACCOUNTABILITY_INBOX_ENABLED=true to seed)',
    );
  }

  let demoSupplier: { id: string; companyName: string | null } | null = null;

  if (!SEED_DEMO_OPERATIONAL_DATA) {
    console.log(
      '⏭️  Skipped demo suppliers/contractors (connector demo uses reset:connector-demo for empty registry)',
    );
  } else {
  // Create demo supplier
  console.log('Creating demo supplier...');

  const existingSupplier = await prisma.supplier.findFirst({
    where: { organizationId: demoOrg.id, email: 'supplier@demo.com' },
  });

  const demoSupplierRecord = existingSupplier ?? (await prisma.supplier.create({
    data: {
      organizationId: demoOrg.id,
      type: SupplierType.COMPANY,
      status: 'ACTIVE',
      companyName: 'Demo Supplier Ltd',
      registrationNumber: '2023/123456/07',
      vatNumber: '4123456789',
      tradingName: 'Demo Supplier',
      email: 'supplier@demo.com',
      phone: '+27123456789',
      addressLine1: '123 Main Street',
      city: 'Johannesburg',
      postalCode: '2000',
      country: 'ZA',
      bankName: 'Standard Bank',
      bankAccountNumber: '123456789',
      bankBranchCode: '051001',
      taxNumber: '9876543210',
      bbbeeLevel: 'Level 1',
    },
  }));
  demoSupplier = demoSupplierRecord;

  console.log(`✅ Created supplier: ${demoSupplierRecord.companyName}`);

  // Isolation proof fixture — second supplier in same org (supplier.admin must not see)
  const otherSupplier =
    (await prisma.supplier.findFirst({
      where: { organizationId: demoOrg.id, email: 'other-supplier@demo.com' },
    })) ??
    (await prisma.supplier.create({
      data: {
        organizationId: demoOrg.id,
        type: SupplierType.COMPANY,
        status: 'ACTIVE',
        companyName: 'Other Supplier Ltd',
        registrationNumber: '2024/999999/07',
        email: 'other-supplier@demo.com',
        phone: '+27999999999',
        country: 'ZA',
      },
    }));
  console.log(`✅ Created isolation fixture supplier: ${otherSupplier.companyName}`);

  // PR-SUPPLIER-SCOPING-1 — bind supplier-portal demo users to demo supplier
  await prisma.supplierMembership.upsert({
    where: {
      userId_supplierId: {
        userId: supplierAdminUser.id,
        supplierId: demoSupplierRecord.id,
      },
    },
    update: { isActive: true },
    create: {
      userId: supplierAdminUser.id,
      supplierId: demoSupplierRecord.id,
      role: 'ADMIN',
      assignedBy: adminUser.id,
    },
  });
  await prisma.supplierMembership.upsert({
    where: {
      userId_supplierId: {
        userId: supplierManagerUser.id,
        supplierId: demoSupplierRecord.id,
      },
    },
    update: { isActive: true },
    create: {
      userId: supplierManagerUser.id,
      supplierId: demoSupplierRecord.id,
      role: 'MANAGER',
      assignedBy: adminUser.id,
    },
  });
  console.log('✅ Supplier memberships linked (admin + manager → demo supplier)');

  // PR-EXTID-SCHEMA-1C — idempotent demo contractor with explicit substrate defaults (not HCM identity)
  console.log('Ensuring demo contractor (substrate defaults)...');
  const demoContractorEmail = 'seed-demo-contractor@demo.local';
  const demoContractorSubstrate = {
    externalPersonId: 'ewp:demo:person:seed-demo-contractor@demo.local',
    personType: ContractorPersonType.PERSON_INDEPENDENT,
    accessIntent: ContractorAccessIntent.ACCESS_NONE,
    riskTier: GovernanceRiskTier.RISK_UNKNOWN,
    workerArchetype: WorkerArchetypeKind.ARCHETYPE_INDEPENDENT,
  };
  const demoContractor =
    (await prisma.contractor.findFirst({
      where: { supplierId: demoSupplierRecord.id, email: demoContractorEmail },
    })) ??
    (await prisma.contractor.create({
      data: {
        organizationId: demoSupplierRecord.organizationId,
        supplierId: demoSupplierRecord.id,
        firstName: 'Seed',
        lastName: 'Contractor',
        email: demoContractorEmail,
        workerClassification: 'INDEPENDENT_CONTRACTOR',
        engagementModel: 'DIRECT',
        taxResidency: 'ZA',
        skills: [],
        ...demoContractorSubstrate,
      },
    }));
  await prisma.contractor.update({
    where: { id: demoContractor.id },
    data: demoContractorSubstrate,
  });
  console.log(`✅ Demo contractor substrate: ${demoContractor.email}`);

  // PR-SPONSOR-SCOPE-VALIDATION-1 — org-wide rows for admin vs sponsor contrast (no responsibleManagerEmployeeId)
  const unsponsoredEmails = [
    'seed-unsponsored-a@demo.local',
    'seed-unsponsored-b@demo.local',
  ];
  for (const email of unsponsoredEmails) {
    const existing = await prisma.contractor.findFirst({
      where: { supplierId: demoSupplierRecord.id, email },
    });
    if (!existing) {
      await prisma.contractor.create({
        data: {
          organizationId: demoSupplierRecord.organizationId,
          supplierId: demoSupplierRecord.id,
          firstName: 'Unsponsored',
          lastName: email.split('@')[0].replace('seed-', ''),
          email,
          workerClassification: 'INDEPENDENT_CONTRACTOR',
          engagementModel: 'DIRECT',
          taxResidency: 'ZA',
          skills: [],
          externalPersonId: `ewp:demo:person:${email}`,
          personType: ContractorPersonType.PERSON_INDEPENDENT,
          accessIntent: ContractorAccessIntent.ACCESS_NONE,
          riskTier: GovernanceRiskTier.RISK_UNKNOWN,
          workerArchetype: WorkerArchetypeKind.ARCHETYPE_INDEPENDENT,
        },
      });
    }
  }
  console.log('✅ Unsponsored demo contractors (admin scope contrast, not visible to sponsor@)');

  console.log('Ensuring demo supplier contract and sponsored engagement...');
  const demoContractNumber = 'DEMO-SEED-001';
  let demoContract = await prisma.supplierContract.findFirst({
    where: {
      organizationId: demoOrg.id,
      supplierId: demoSupplierRecord.id,
      contractNumber: demoContractNumber,
    },
  });
  if (!demoContract) {
    demoContract = await prisma.supplierContract.create({
      data: {
        supplierId: demoSupplierRecord.id,
        organizationId: demoOrg.id,
        contractNumber: demoContractNumber,
        contractType: ContractType.TIME_AND_MATERIALS,
        title: 'Demo Supplier Master Agreement',
        startDate: new Date(),
        status: 'ACTIVE',
      },
    });
  }
  console.log(`✅ Demo supplier contract: ${demoContract.contractNumber}`);

  const existingSponsoredEngagement = await prisma.contractorEngagement.findFirst({
    where: {
      contractorId: demoContractor.id,
      contractId: demoContract.id,
    },
  });
  if (!existingSponsoredEngagement) {
    await prisma.contractorEngagement.create({
      data: {
        contractorId: demoContractor.id,
        contractId: demoContract.id,
        role: 'Demo sponsored placement',
        startDate: new Date(),
        rateType: 'HOURLY',
        rateAmount: 1000,
        currency: 'ZAR',
        isActive: true,
        responsibleManagerEmployeeId: DEMO_SPONSOR_HCM_EMPLOYEE_ID,
        responsibleManagerStatus: ResponsibleManagerAccountabilityStatus.RESPONSIBLE_MANAGER_ASSIGNED,
      },
    });
  } else {
    await prisma.contractorEngagement.update({
      where: { id: existingSponsoredEngagement.id },
      data: {
        responsibleManagerEmployeeId: DEMO_SPONSOR_HCM_EMPLOYEE_ID,
        responsibleManagerStatus: ResponsibleManagerAccountabilityStatus.RESPONSIBLE_MANAGER_ASSIGNED,
      },
    });
  }
  console.log(
    `✅ Demo contractor engagement (sponsored by ${DEMO_SPONSOR_HCM_EMPLOYEE_ID})`,
  );
  }

  // PR-CTR-CONNECTOR-1G — governance test personas (GUI validation)
  console.log('Creating governance test personas...');

  async function upsertGovernanceUser(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    roleId: string;
    roleLabel: string;
  }) {
    const passwordHash = await hashPassword(input.password);
    const user = await prisma.user.upsert({
      where: { email: input.email },
      update: { isActive: true, emailVerified: true },
      create: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        userType: UserType.INTERNAL,
        organizationId: demoOrg.id,
        isActive: true,
        emailVerified: true,
      },
    });
    await prisma.userRole.upsert({
      where: {
        userId_roleId_organizationId: {
          userId: user.id,
          roleId: input.roleId,
          organizationId: demoOrg.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: input.roleId,
        organizationId: demoOrg.id,
        assignedBy: adminUser.id,
      },
    });
    console.log(`✅ ${input.roleLabel}: ${user.email} (${input.password})`);
    return user;
  }

  await upsertGovernanceUser({
    email: DEMO_LOGIN_PERSONAS.integrationOperator.email,
    password: DEMO_LOGIN_PERSONAS.integrationOperator.password,
    firstName: DEMO_LOGIN_PERSONAS.integrationOperator.firstName,
    lastName: DEMO_LOGIN_PERSONAS.integrationOperator.lastName,
    roleId: governanceIntegrationOperatorRole.id,
    roleLabel: DEMO_LOGIN_PERSONAS.integrationOperator.audienceLabel,
  });

  await upsertGovernanceUser({
    email: DEMO_LOGIN_PERSONAS.supplierReviewer.email,
    password: DEMO_LOGIN_PERSONAS.supplierReviewer.password,
    firstName: DEMO_LOGIN_PERSONAS.supplierReviewer.firstName,
    lastName: DEMO_LOGIN_PERSONAS.supplierReviewer.lastName,
    roleId: supplierGovernanceReviewerRole.id,
    roleLabel: DEMO_LOGIN_PERSONAS.supplierReviewer.audienceLabel,
  });

  const governanceOpsUser = await upsertGovernanceUser({
    email: DEMO_LOGIN_PERSONAS.workforceImportAdmin.email,
    password: DEMO_LOGIN_PERSONAS.workforceImportAdmin.password,
    firstName: DEMO_LOGIN_PERSONAS.workforceImportAdmin.firstName,
    lastName: DEMO_LOGIN_PERSONAS.workforceImportAdmin.lastName,
    roleId: governanceOpsRole.id,
    roleLabel: `${DEMO_LOGIN_PERSONAS.workforceImportAdmin.audienceLabel} (DEMO composite)`,
  });

  const governanceReviewerUser = await upsertGovernanceUser({
    email: DEMO_LOGIN_PERSONAS.governanceReviewer.email,
    password: DEMO_LOGIN_PERSONAS.governanceReviewer.password,
    firstName: DEMO_LOGIN_PERSONAS.governanceReviewer.firstName,
    lastName: DEMO_LOGIN_PERSONAS.governanceReviewer.lastName,
    roleId: governanceReviewerRole.id,
    roleLabel: DEMO_LOGIN_PERSONAS.governanceReviewer.audienceLabel,
  });

  await upsertGovernanceUser({
    email: DEMO_LOGIN_PERSONAS.engagementOps.email,
    password: DEMO_LOGIN_PERSONAS.engagementOps.password,
    firstName: DEMO_LOGIN_PERSONAS.engagementOps.firstName,
    lastName: DEMO_LOGIN_PERSONAS.engagementOps.lastName,
    roleId: contractorManagerRole.id,
    roleLabel: DEMO_LOGIN_PERSONAS.engagementOps.audienceLabel,
  });

  await upsertGovernanceUser({
    email: DEMO_LOGIN_PERSONAS.governanceViewer.email,
    password: DEMO_LOGIN_PERSONAS.governanceViewer.password,
    firstName: DEMO_LOGIN_PERSONAS.governanceViewer.firstName,
    lastName: DEMO_LOGIN_PERSONAS.governanceViewer.lastName,
    roleId: governanceViewerRole.id,
    roleLabel: DEMO_LOGIN_PERSONAS.governanceViewer.audienceLabel,
  });

  const supplierPortalUser = await upsertGovernanceUser({
    email: DEMO_LOGIN_PERSONAS.supplierPortalOperator.email,
    password: DEMO_LOGIN_PERSONAS.supplierPortalOperator.password,
    firstName: DEMO_LOGIN_PERSONAS.supplierPortalOperator.firstName,
    lastName: DEMO_LOGIN_PERSONAS.supplierPortalOperator.lastName,
    roleId: supplierAdminRole.id,
    roleLabel: DEMO_LOGIN_PERSONAS.supplierPortalOperator.audienceLabel,
  });
  if (demoSupplier) {
    await prisma.supplierMembership.upsert({
      where: {
        userId_supplierId: {
          userId: supplierPortalUser.id,
          supplierId: demoSupplier.id,
        },
      },
      update: { isActive: true },
      create: {
        userId: supplierPortalUser.id,
        supplierId: demoSupplier.id,
        role: 'ADMIN',
        assignedBy: adminUser.id,
      },
    });
  } else {
    console.log(
      '   Supplier portal membership deferred until supplier sync + demo setup (or migration reset with comparison anchors)',
    );
  }

  // Connector demos use live mock-Oracle ingestion — not pre-seeded connector outcomes.
  // Optional legacy static fixtures: SEED_GOVERNANCE_FIXTURES=true npm run db:seed
  if (process.env.SEED_GOVERNANCE_FIXTURES === 'true') {
    if (!demoSupplier) {
      throw new Error(
        'SEED_GOVERNANCE_FIXTURES requires SEED_DEMO_OPERATIONAL_DATA=true (demo supplier id)',
      );
    }
    await seedGovernanceFixtures(prisma, {
      organizationId: demoOrg.id,
      demoSupplierId: demoSupplier.id,
      governanceOpsUserId: governanceOpsUser.id,
      governanceReviewerUserId: governanceReviewerUser.id,
    });
    console.log('   - Governance connector fixtures (SEED_GOVERNANCE_FIXTURES=true)');
  } else {
    console.log(
      '   - Governance connector fixtures skipped (use npm run reset:connector-demo for empty baseline)',
    );
  }

  console.log('\n🎉 Seeding completed successfully!');
  console.log('\n📋 Summary:');
  console.log(
    '   - 13 system roles (incl. GOVERNANCE_INTEGRATION_OPERATOR, SUPPLIER_GOVERNANCE_REVIEWER, GOVERNANCE_OPERATIONS_ADMIN demo composite)',
  );
  console.log(
    '   - 1 organization (Demo Organization — ORACLE_ONLY suppliers, HYBRID contractors)',
  );
  console.log('   - Demo users (@ewp.demo — business personas):');
  for (const persona of Object.values(DEMO_LOGIN_PERSONAS)) {
    if (persona.id === 'sponsor-inbox' && !SPONSOR_INBOX_ENABLED) continue;
    console.log(`     • ${persona.email} (${persona.password}) — ${persona.audienceLabel}`);
  }
  if (SEED_DEMO_OPERATIONAL_DATA) {
    console.log('   - Demo operational data: suppliers, contractors, contract, engagement');
  } else {
    console.log('   - Demo operational registry empty until connector sync (see reset:connector-demo)');
  }
  console.log(
    '   - Governance connector fixtures: only when SEED_GOVERNANCE_FIXTURES=true',
  );
  console.log('\n🚀 You can now login at http://localhost:3000/api/v1/auth/login');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
