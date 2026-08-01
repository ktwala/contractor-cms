/**
 * Bootstrap First Admin User
 *
 * Creates the first administrator for a fresh Hubsec Workforce Platform deployment.
 * Requires roles/permissions to exist (run db:seed first).
 *
 * Run:
 *   BOOTSTRAP_ADMIN_EMAIL=admin@company.com \
 *   BOOTSTRAP_ADMIN_PASSWORD=SecurePass123 \
 *   npm run bootstrap:admin
 *
 * Skips if any users already exist.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const firstName = process.env.BOOTSTRAP_ADMIN_FIRST_NAME || 'System';
  const lastName = process.env.BOOTSTRAP_ADMIN_LAST_NAME || 'Admin';

  if (!email || !password) {
    throw new Error(
      'BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are required.\n' +
        'Example: BOOTSTRAP_ADMIN_EMAIL=admin@company.com BOOTSTRAP_ADMIN_PASSWORD=SecurePass123 npm run bootstrap:admin',
    );
  }

  const PASSWORD_RE =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()[\]\-_+=.,;:'"`~]).{12,}$/;
  if (!PASSWORD_RE.test(password)) {
    throw new Error(
      'BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters with uppercase, lowercase, number, and special character',
    );
  }

  const existingCount = await prisma.user.count();
  if (existingCount > 0) {
    console.log('Users already exist. Bootstrap skipped.');
    return;
  }

  const role = await prisma.role.findUnique({
    where: { name: 'TENANT_ADMIN' },
  });
  if (!role) {
    throw new Error(
      'TENANT_ADMIN role not found. Run npm run db:seed first to create roles and permissions.',
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const adminUser = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName,
      lastName,
      isActive: true,
    },
  });

  await prisma.roleAssignment.create({
    data: {
      userId: adminUser.id,
      roleId: role.id,
      scopeType: 'GLOBAL',
      legalEntityId: null,
    },
  });

  console.log('✅ Bootstrap admin created:', email);
  console.log('   Role: TENANT_ADMIN (GLOBAL scope)');
}

main()
  .catch((e) => {
    console.error('❌ Bootstrap failed:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
