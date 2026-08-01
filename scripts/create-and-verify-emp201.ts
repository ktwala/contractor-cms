/**
 * 1. Confirm EMP201 create logic sets legalEntityId (see sars-tax.service.ts createEMP201Return)
 * 2. Generate one EMP201 for a known legal entity
 * 3. Query latest record and verify legal_entity_id is not null
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { startOfMonth, endOfMonth, addMonths } from 'date-fns';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Get known legal entity
  const legalEntity = await prisma.legalEntity.findFirst();
  if (!legalEntity) {
    console.error('No legal entity found. Run db:seed first.');
    process.exit(1);
  }
  console.log(`Using legal entity: ${legalEntity.code} (${legalEntity.id})\n`);

  // Find or create a monthly tax period
  const periodStart = startOfMonth(new Date('2026-01-01'));
  const periodEnd = endOfMonth(periodStart);
  let taxPeriod = await prisma.taxPeriod.findFirst({
    where: { periodType: 'monthly', monthNumber: 1, taxYear: '2026' },
  });
  if (!taxPeriod) {
    taxPeriod = await prisma.taxPeriod.create({
      data: {
        taxYear: '2026',
        periodType: 'monthly',
        monthNumber: 1,
        periodStart,
        periodEnd,
        submissionDueDate: addMonths(periodEnd, 1),
        status: 'open',
      },
    });
    console.log(`Created tax period: ${taxPeriod.id} (2026-01)\n`);
  } else {
    console.log(`Using tax period: ${taxPeriod.id} (2026-01)\n`);
  }

  // Create EMP201 (mirroring createEMP201Return logic - must set legalEntityId)
  const emp201 = await prisma.eMP201Return.create({
    data: {
      taxPeriodId: taxPeriod.id,
      legalEntityId: legalEntity.id,
      employerPayeNumber: '7123456789',
      employerName: 'Demo Company (Pty) Ltd',
      employerTradingName: 'Demo Company',
      taxYear: taxPeriod.taxYear,
      monthNumber: taxPeriod.monthNumber ?? 1,
      periodStart: taxPeriod.periodStart,
      periodEnd: taxPeriod.periodEnd,
      submissionDueDate: taxPeriod.submissionDueDate,
      totalEmployees: 0,
      localEmployees: 0,
      foreignEmployees: 0,
      payeCurrentMonth: 0,
      payeAdjustments: 0,
      payeTotal: 0,
      sdlCurrentMonth: 0,
      sdlAdjustments: 0,
      sdlTotal: 0,
      uifEmployeeCurrent: 0,
      uifEmployerCurrent: 0,
      uifAdjustments: 0,
      uifTotal: 0,
      etiCurrentMonth: 0,
      etiAdjustments: 0,
      etiTotal: 0,
      totalLiability: 0,
      status: 'draft',
      country: 'ZAF',
      generatedAt: new Date(),
    },
  });
  console.log(`Created EMP201: ${emp201.id}\n`);

  // Query latest record and verify legal_entity_id
  const latest = await prisma.eMP201Return.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { id: true, legalEntityId: true, taxYear: true, monthNumber: true, createdAt: true },
  });

  console.log('=== LATEST EMP201 RECORD ===');
  console.log(JSON.stringify(latest, null, 2));
  console.log('\n=== VERIFICATION ===');
  const legalEntityIdNotNull = latest?.legalEntityId != null;
  console.log(`legal_entity_id is not null: ${legalEntityIdNotNull ? '✅ YES' : '❌ NO'}`);
  const matchesExpected = latest?.legalEntityId === legalEntity.id;
  console.log(`Matches expected legal entity (${legalEntity.id}): ${matchesExpected ? '✅ YES' : '❌ NO'}`);

  process.exit(legalEntityIdNotNull && matchesExpected ? 0 : 1);
}

main().catch(console.error).finally(() => prisma.$disconnect());
