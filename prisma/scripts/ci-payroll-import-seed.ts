/**
 * Minimal tenant data for payroll import CI (template reference data + readiness).
 * Run after `npm run db:seed` (roles, permissions, global pay items).
 *
 * Idempotent: safe to run repeatedly.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const LEGAL_ENTITY_CODE = 'ci-payroll-le';
const PAY_GROUP_CODE = 'ci-payroll-pg';

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const le = await prisma.legalEntity.upsert({
    where: { code: LEGAL_ENTITY_CODE },
    create: {
      code: LEGAL_ENTITY_CODE,
      name: 'CI Payroll Legal Entity',
      country: 'ZA',
    },
    update: {
      name: 'CI Payroll Legal Entity',
      country: 'ZA',
    },
  });

  await prisma.payGroup.upsert({
    where: { code: PAY_GROUP_CODE },
    create: {
      code: PAY_GROUP_CODE,
      name: 'CI Pay Group',
      country: 'ZA',
      currency: 'ZAR',
      frequency: 'MONTHLY',
      legalEntityId: le.id,
    },
    update: {
      name: 'CI Pay Group',
      country: 'ZA',
      currency: 'ZAR',
      frequency: 'MONTHLY',
      legalEntityId: le.id,
    },
  });

  const pgCount = await prisma.payGroup.count();
  const piCount = await prisma.payItem.count({ where: { isActive: true } });
  console.log(`CI payroll import seed OK (legal entity + pay group). pay_groups=${pgCount}, active pay_items=${piCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
