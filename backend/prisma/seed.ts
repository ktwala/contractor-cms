import {
  PrismaClient,
  UserType,
  SupplierType,
  ContractorPersonType,
  ContractorAccessIntent,
  GovernanceRiskTier,
  WorkerArchetypeKind,
} from '@prisma/client';
import * as argon2 from 'argon2';
import {
  isKnownPermission,
  isValidPermissionFormat,
} from '../src/core/auth/permissions.constants';
import { SEED_TARGET_ROLE_PERMISSIONS } from '../src/core/auth/seed-system-role-bundles';

const prisma = new PrismaClient();

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

  // Create default roles
  console.log('Creating default roles...');

  const cmsAdminRole = await prisma.role.upsert({
    where: { name: 'CMS_ADMIN' },
    update: {},
    create: {
      name: 'CMS_ADMIN',
      description: 'Full system administrator access',
      permissions: ['*:*'], // All permissions
      isSystemRole: true,
    },
  });

  const financeUserRole = await prisma.role.upsert({
    where: { name: 'FINANCE_USER' },
    update: {},
    create: {
      name: 'FINANCE_USER',
      description: 'Finance and AP user',
      permissions: [
        'invoices:read',
        'invoices:approve',
        'suppliers:read',
        'contractors:read',
        'timesheets:read',
        'timesheets:approve',
      ],
      isSystemRole: true,
    },
  });

  const contractorManagerRole = await prisma.role.upsert({
    where: { name: 'CONTRACTOR_MANAGER' },
    update: {},
    create: {
      name: 'CONTRACTOR_MANAGER',
      description: 'Contractor and supplier manager',
      permissions: [
        'suppliers:create',
        'suppliers:read',
        'suppliers:update',
        'contractors:create',
        'contractors:read',
        'contractors:update',
        'contracts:create',
        'contracts:read',
        'contracts:update',
        'timesheets:read',
        'timesheets:approve',
        'tax-classifications:create',
        'tax-classifications:read',
      ],
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
      description: 'Target: supplier-side org admin (scoped auth TBD)',
      permissions: supplierAdminPerms,
    },
    create: {
      name: 'SUPPLIER_ADMIN',
      description: 'Target: supplier-side org admin (scoped auth TBD)',
      permissions: supplierAdminPerms,
      isSystemRole: true,
    },
  });

  const supplierManagerRole = await prisma.role.upsert({
    where: { name: 'SUPPLIER_MANAGER' },
    update: {
      description: 'Target: supplier operations manager (timesheet oversight)',
      permissions: supplierManagerPerms,
    },
    create: {
      name: 'SUPPLIER_MANAGER',
      description: 'Target: supplier operations manager (timesheet oversight)',
      permissions: supplierManagerPerms,
      isSystemRole: true,
    },
  });

  const sponsorRole = await prisma.role.upsert({
    where: { name: 'SPONSOR' },
    update: {
      description: 'Target: workforce sponsor / hiring manager (HCM link TBD)',
      permissions: sponsorPerms,
    },
    create: {
      name: 'SPONSOR',
      description: 'Target: workforce sponsor / hiring manager (HCM link TBD)',
      permissions: sponsorPerms,
      isSystemRole: true,
    },
  });

  // Validate all seeded permissions against the canonical catalog
  const seededRoles = [
    { name: 'CMS_ADMIN', permissions: cmsAdminRole.permissions },
    { name: 'FINANCE_USER', permissions: financeUserRole.permissions },
    { name: 'CONTRACTOR_MANAGER', permissions: contractorManagerRole.permissions },
    { name: 'CONTRACTOR', permissions: contractorRole.permissions },
    { name: 'SUPPLIER_ADMIN', permissions: supplierAdminRole.permissions },
    { name: 'SUPPLIER_MANAGER', permissions: supplierManagerRole.permissions },
    { name: 'SPONSOR', permissions: sponsorRole.permissions },
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
    update: {},
    create: {
      name: 'Demo Organization',
      code: 'DEMO',
      country: 'ZA',
      currency: 'ZAR',
      timezone: 'Africa/Johannesburg',
      hcmType: 'CUSTOM_NATS',
      hcmConfig: {
        natsUrl: 'nats://localhost:4222',
        subject: 'hcm.withholding',
      },
      isActive: true,
    },
  });

  console.log(`✅ Created organization: ${demoOrg.name}`);

  // Create admin user
  console.log('Creating admin user...');

  const adminPasswordHash = await hashPassword('Admin123!');

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@contractor-cms.com' },
    update: {},
    create: {
      email: 'admin@contractor-cms.com',
      passwordHash: adminPasswordHash,
      firstName: 'Admin',
      lastName: 'User',
      userType: UserType.INTERNAL,
      isActive: true,
      emailVerified: true,
    },
  });

  // Assign admin role (global CMS admin: use empty-string org key for composite unique)
  await prisma.userRole.upsert({
    where: {
      userId_roleId_organizationId: {
        userId: adminUser.id,
        roleId: cmsAdminRole.id,
        organizationId: '',
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: cmsAdminRole.id,
      assignedBy: 'system',
    },
  });

  console.log(`✅ Created admin user: ${adminUser.email}`);
  console.log(`   Password: Admin123!`);

  // Create finance user
  console.log('Creating finance user...');

  const financePasswordHash = await hashPassword('Finance123!');

  const financeUser = await prisma.user.upsert({
    where: { email: 'finance@contractor-cms.com' },
    update: {},
    create: {
      email: 'finance@contractor-cms.com',
      passwordHash: financePasswordHash,
      firstName: 'Finance',
      lastName: 'User',
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
  console.log(`   Password: Finance123!`);

  // Create demo supplier
  console.log('Creating demo supplier...');

  const existingSupplier = await prisma.supplier.findFirst({
    where: { organizationId: demoOrg.id, email: 'supplier@demo.com' },
  });

  const demoSupplier = existingSupplier ?? (await prisma.supplier.create({
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

  console.log(`✅ Created supplier: ${demoSupplier.companyName}`);

  // PR-EXTID-SCHEMA-1C — idempotent demo contractor with explicit substrate defaults (not HCM identity)
  console.log('Ensuring demo contractor (substrate defaults)...');
  const demoContractorEmail = 'seed-demo-contractor@demo.local';
  const demoContractorSubstrate = {
    externalPersonId: 'cms:demo:person:seed-demo-contractor@demo.local',
    personType: ContractorPersonType.PERSON_INDEPENDENT,
    accessIntent: ContractorAccessIntent.ACCESS_NONE,
    riskTier: GovernanceRiskTier.RISK_UNKNOWN,
    workerArchetype: WorkerArchetypeKind.ARCHETYPE_INDEPENDENT,
  };
  const demoContractor =
    (await prisma.contractor.findFirst({
      where: { supplierId: demoSupplier.id, email: demoContractorEmail },
    })) ??
    (await prisma.contractor.create({
      data: {
        supplierId: demoSupplier.id,
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

  console.log('\n🎉 Seeding completed successfully!');
  console.log('\n📋 Summary:');
  console.log(
    '   - 7 system roles (CMS_ADMIN, FINANCE_USER, CONTRACTOR_MANAGER, CONTRACTOR, SUPPLIER_ADMIN, SUPPLIER_MANAGER, SPONSOR)',
  );
  console.log('   - 1 organization created (Demo Organization)');
  console.log('   - 2 users created:');
  console.log('     • admin@contractor-cms.com (password: Admin123!)');
  console.log('     • finance@contractor-cms.com (password: Finance123!)');
  console.log('   - 1 supplier created (Demo Supplier Ltd)');
  console.log('   - 1 demo contractor row (EXTID substrate defaults applied idempotently)');
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
