/**
 * Removes the persistent `deployment_mode=customer` row from `platform_settings`
 * so `npm run demo:seed` can run again (e.g. after `db:reset-for-customer`).
 *
 * Run: npm run db:clear-customer-flag
 * Docker: docker compose exec app npm run db:clear-customer-flag
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

  const n = await prisma.$executeRaw`
    DELETE FROM platform_settings WHERE key = 'deployment_mode'
  `;
  console.log(`Removed deployment_mode from platform_settings (${Number(n)} row(s)).`);
  console.log('You can run: npm run db:seed && npm run demo:seed && npm run demo:seed:recruitment-users');
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
