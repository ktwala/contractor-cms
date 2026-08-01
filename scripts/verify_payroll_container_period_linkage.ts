/**
 * PR-PAYROLL-CONTAINER-2 — verify `pay_periods.payroll_id` linkage integrity.
 *
 * Reports:
 *   - periods linked (payroll_id set)
 *   - orphan periods (null payroll_id)
 *   - duplicate Payroll shells (same pay_group + tax_year_start + tax_year_end)
 *   - periods whose payroll.pay_group_id ≠ period.pay_group_id
 *
 * Exit code 1 only for structural integrity failures (duplicates or mismatched FK semantics).
 * Orphan periods are reported but do not fail CI (operators run backfill separately).
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/verify_payroll_container_period_linkage.ts
 */
import * as dotenv from 'dotenv';
import { createScriptPrisma } from './lib/prisma-script-client';

dotenv.config();

async function main(): Promise<void> {
  const { prisma, shutdown } = createScriptPrisma();

  try {
    const totalPeriods = await prisma.payPeriod.count();
    const linked = await prisma.payPeriod.count({ where: { payrollId: { not: null } } });
    const orphans = await prisma.payPeriod.count({ where: { payrollId: null } });

    const duplicateRows = await prisma.$queryRaw<
      Array<{ pay_group_id: string; tax_year_start: Date; tax_year_end: Date; c: bigint }>
    >`
      SELECT pay_group_id, tax_year_start, tax_year_end, COUNT(*)::bigint AS c
      FROM payrolls
      GROUP BY pay_group_id, tax_year_start, tax_year_end
      HAVING COUNT(*) > 1
    `;

    const mismatchRows = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count
      FROM pay_periods pp
      INNER JOIN payrolls p ON p.id = pp.payroll_id
      WHERE pp.pay_group_id <> p.pay_group_id
    `;
    const mismatchCount = Number(mismatchRows[0]?.count ?? 0);

    console.log('[verify_payroll_container_period_linkage] — PR-PAYROLL-CONTAINER-2');
    console.log(`  pay_periods total:        ${totalPeriods}`);
    console.log(`  periods linked:           ${linked}`);
    console.log(`  orphan periods (null):    ${orphans}`);
    console.log(`  duplicate shell keys:     ${duplicateRows.length}`);
    console.log(`  period↔shell mismatch:    ${mismatchCount}`);

    if (duplicateRows.length > 0) {
      console.error('[verify_payroll_container_period_linkage] FAIL: duplicate Payroll rows for same pay_group + tax window');
      for (const d of duplicateRows.slice(0, 20)) {
        console.error(
          `  dup pay_group_id=${d.pay_group_id} start=${d.tax_year_start.toISOString()} end=${d.tax_year_end.toISOString()} count=${d.c}`,
        );
      }
      process.exitCode = 1;
    }

    if (mismatchCount > 0) {
      console.error(
        '[verify_payroll_container_period_linkage] FAIL: period linked to Payroll from a different PayGroup',
      );
      process.exitCode = 1;
    }

    if (!process.exitCode) {
      console.log('[verify_payroll_container_period_linkage] OK (no duplicate shells / no mismatched links)');
    }
  } finally {
    await shutdown();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
