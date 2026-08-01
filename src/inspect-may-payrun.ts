import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://workforce:workforce_secret@localhost:5432/workforce_platform",
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const payrun = await prisma.payRun.findUnique({
      where: { id: 'f0063e68-0953-4924-b968-992476f11dca' },
      include: {
        payGroup: {
          include: {
            legalEntity: true,
          }
        },
        results: {
          include: {
            employee: true,
          }
        }
      }
    });

    console.log('--- May Payrun Details ---');
    console.log(JSON.stringify({
      id: payrun?.id,
      status: payrun?.status,
      periodStart: payrun?.periodStart,
      periodEnd: payrun?.periodEnd,
      payGroup: {
        id: payrun?.payGroup?.id,
        name: payrun?.payGroup?.name,
        code: payrun?.payGroup?.code,
        country: payrun?.payGroup?.country,
        legalEntity: {
          id: payrun?.payGroup?.legalEntity?.id,
          name: payrun?.payGroup?.legalEntity?.name,
        }
      },
      resultsCount: payrun?.results?.length,
      employees: payrun?.results?.map(r => `${r.employee?.firstName} ${r.employee?.lastName}`),
    }, null, 2));

  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch(console.error);
