/**
 * PR-PAYROLL-CONTAINER-2 — backfill `pay_periods.payroll_id` from PayGroup country + period.start_date.
 *
 * One Payroll row per (pay_group_id, tax_year_start, tax_year_end). PayGroup already fixes
 * legal entity + pay frequency; the shell adds the statutory window for that group.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/backfill_pay_period_payroll_ids.ts [--dry-run] [--limit=N]
 *
 * `--dry-run` prints planned upserts/updates without writing.
 */
import * as dotenv from 'dotenv';
import { payrollContainerLabel } from './lib/payroll-container-label';
import { createScriptPrisma } from './lib/prisma-script-client';
import { statutoryTaxYearWindowForDate } from './lib/payroll-tax-year-window';

dotenv.config();

function parseArgs(): { dryRun: boolean; limit?: number } {
  const dryRun = process.argv.includes('--dry-run');
  let limit: number | undefined;
  const lim = process.argv.find((a) => a.startsWith('--limit='));
  if (lim) {
    const n = Number(lim.split('=')[1]);
    if (!Number.isFinite(n) || n < 1) throw new Error('Invalid --limit');
    limit = Math.floor(n);
  }
  return { dryRun, limit };
}

async function main(): Promise<void> {
  const { prisma, shutdown } = createScriptPrisma();

  try {
    const { dryRun, limit } = parseArgs();

    const periods = await prisma.payPeriod.findMany({
      where: { payrollId: null },
      include: { payGroup: true },
      orderBy: [{ payGroupId: 'asc' }, { startDate: 'asc' }, { id: 'asc' }],
      ...(limit ? { take: limit } : {}),
    });

    console.log(
      `[backfill_pay_period_payroll_ids] ${dryRun ? 'DRY-RUN ' : ''}processing ${periods.length} period(s) with null payroll_id`,
    );

    let linked = 0;

    for (const period of periods) {
      const pg = period.payGroup;
      const window = statutoryTaxYearWindowForDate(pg.country, period.startDate);
      const label = payrollContainerLabel({
        country: pg.country,
        frequency: pg.frequency,
        payGroupCode: pg.code,
        windowLabel: window.label,
      });

      if (dryRun) {
        console.log(
          `  would upsert Payroll ${pg.code} window=${window.label} → link period ${period.id} (${period.year}-${period.periodNum})`,
        );
        linked++;
        continue;
      }

      const payroll = await prisma.payroll.upsert({
        where: {
          payGroupId_taxYearStart_taxYearEnd: {
            payGroupId: pg.id,
            taxYearStart: window.taxYearStart,
            taxYearEnd: window.taxYearEnd,
          },
        },
        create: {
          payGroupId: pg.id,
          label,
          taxYearStart: window.taxYearStart,
          taxYearEnd: window.taxYearEnd,
        },
        update: { label },
      });

      await prisma.payPeriod.update({
        where: { id: period.id },
        data: { payrollId: payroll.id },
      });
      linked++;
    }

    console.log(`[backfill_pay_period_payroll_ids] done: linked=${linked}${dryRun ? ' (dry-run)' : ''}`);
  } finally {
    await shutdown();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
