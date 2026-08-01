/**
 * Reset Database for Customer Environment
 *
 * Clears ALL data from the platform, leaving a clean schema.
 * Use before onboarding a new customer or creating a fresh environment.
 *
 * Run: DATABASE_URL="..." npm run db:reset-for-customer
 *
 * Does NOT:
 * - Drop the database
 * - Modify schema or migrations
 * - Reseed any data
 *
 * After reset, you can:
 * - Run npm run db:seed then bootstrap:admin or demo:seed (see docs/BOOTSTRAP.md)
 * - Or leave empty for customer to configure via Data Import Console / UI
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  console.log('🧹 Resetting database for customer environment...\n');

  // Get all tables in public schema (excluding _prisma_migrations)
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename != '_prisma_migrations'
    ORDER BY tablename
  `;

  if (tables.length === 0) {
    console.log('No tables found. Schema may be empty.');
    return;
  }

  // Disable triggers temporarily for faster truncate
  await prisma.$executeRawUnsafe('SET session_replication_role = replica;');

  const tableList = tables.map((t) => `"${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE;`,
  );

  // Re-enable triggers
  await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');

  // Write a persistent flag so demo:seed never runs on this database,
  // even if the container restarts without DEPLOYMENT_MODE=customer.
  // The platform_settings table is defined in the Prisma schema so db push won't drop it.
  await prisma.$executeRawUnsafe(`
    INSERT INTO platform_settings (key, value) VALUES ('deployment_mode', 'customer')
    ON CONFLICT (key) DO UPDATE SET value = 'customer';
  `);

  console.log(`✅ Cleared ${tables.length} tables.`);
  console.log('✅ Set deployment_mode=customer flag (demo seed will never run).');
  console.log('\n📋 Database is now a clean slate.');
  console.log(
    '\n   Next steps:',
  );
  console.log('   • npm run db:seed → npm run bootstrap:admin');
  console.log('   • See docs/BOOTSTRAP.md');
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
