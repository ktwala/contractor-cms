import { PrismaClient, UserType, SupplierType } from '@prisma/client';
import * as argon2 from 'argon2';

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
        'invoices:reject',
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
        'classifications:create',
        'classifications:read',
      ],
      isSystemRole: true,
    },
  });

  const contractorRole = await prisma.role.upsert({
    where: { name: 'CONTRACTOR' },
    update: {},
    create: {
      name: 'CONTRACTOR',
      description: 'Contractor self-service access',
      permissions: [
        'timesheets:create',
        'timesheets:read',
        'timesheets:update',
        'invoices:read',
        'profile:read',
        'profile:update',
      ],
      isSystemRole: true,
    },
  });

  console.log(`✅ Created ${4} default roles`);

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

  // Assign admin role
  await prisma.userRole.upsert({
    where: {
      userId_roleId_organizationId: {
        userId: adminUser.id,
        roleId: cmsAdminRole.id,
        organizationId: null,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: cmsAdminRole.id,
      organizationId: null,
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

  const demoSupplier = await prisma.supplier.upsert({
    where: {
      organizationId_email: {
        organizationId: demoOrg.id,
        email: 'supplier@demo.com',
      },
    },
    update: {},
    create: {
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
  });

  console.log(`✅ Created supplier: ${demoSupplier.companyName}`);

  console.log('\n🎉 Seeding completed successfully!');
  console.log('\n📋 Summary:');
  console.log('   - 4 roles created (CMS_ADMIN, FINANCE_USER, CONTRACTOR_MANAGER, CONTRACTOR)');
  console.log('   - 1 organization created (Demo Organization)');
  console.log('   - 2 users created:');
  console.log('     • admin@contractor-cms.com (password: Admin123!)');
  console.log('     • finance@contractor-cms.com (password: Finance123!)');
  console.log('   - 1 supplier created (Demo Supplier Ltd)');
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
