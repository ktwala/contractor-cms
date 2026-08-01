/**
 * PR-PAYROLL-CONTAINER-4 — governed close/archive rules for tax-year shells (pure helpers + tests).
 */
import type { PayRunStatus } from '@prisma/client';

/** Payruns that block *closing* the shell — work still in-flight before execution completes. */
export const PAYRUN_ACTIVE_IN_FLIGHT_STATUSES: readonly PayRunStatus[] = [
  'DRAFT',
  'SNAPSHOT',
  'CALCULATING',
  'CALCULATED',
  'IN_REVIEW',
  'APPROVED',
];

/** Payruns that constitute completed payroll activity — archive blocked while these exist on linked periods. */
export const PAYRUN_PAYROLL_ACTIVITY_STATUSES: readonly PayRunStatus[] = ['PAID', 'POSTED', 'FINALIZED'];

export type ArchiveBlockerCode =
  | 'PAYROLL_ARCHIVE_CLOSED_PERIODS'
  | 'PAYROLL_ARCHIVE_ACTIVE_PAYRUNS'
  | 'PAYROLL_ARCHIVE_PAYROLL_ACTIVITY';

export type ArchiveBlocker = { code: ArchiveBlockerCode; message: string };

export type CloseBlockerCode = 'PAYROLL_CLOSE_ACTIVE_PAYRUNS';

export type CloseBlocker = { code: CloseBlockerCode; message: string };

export function collectArchiveBlockers(counts: {
  periodsClosedCount: number;
  activePayrunCount: number;
  activityPayrunCount: number;
}): ArchiveBlocker[] {
  const out: ArchiveBlocker[] = [];
  if (counts.periodsClosedCount > 0) {
    out.push({
      code: 'PAYROLL_ARCHIVE_CLOSED_PERIODS',
      message: `${counts.periodsClosedCount} linked period(s) are governance-closed.`,
    });
  }
  if (counts.activePayrunCount > 0) {
    out.push({
      code: 'PAYROLL_ARCHIVE_ACTIVE_PAYRUNS',
      message: `${counts.activePayrunCount} payrun(s) are still in-flight on linked periods.`,
    });
  }
  if (counts.activityPayrunCount > 0) {
    out.push({
      code: 'PAYROLL_ARCHIVE_PAYROLL_ACTIVITY',
      message: `${counts.activityPayrunCount} payrun(s) reached paid/posted/finalized on linked periods.`,
    });
  }
  return out;
}

export function collectCloseBlockers(activePayrunCount: number): CloseBlocker[] {
  if (activePayrunCount <= 0) return [];
  return [
    {
      code: 'PAYROLL_CLOSE_ACTIVE_PAYRUNS',
      message: `${activePayrunCount} payrun(s) are still in-flight on linked periods.`,
    },
  ];
}
