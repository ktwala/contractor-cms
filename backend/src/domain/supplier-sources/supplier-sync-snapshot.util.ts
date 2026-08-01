import { SupplierSourceSyncRun, SupplierSourceSyncRunStatus } from '@prisma/client';

/** User-facing supplier sync snapshot label, e.g. SYNC-00015 */
export function formatSupplierSyncSnapshotRef(sequence: number): string {
  return `SYNC-${String(sequence).padStart(5, '0')}`;
}

export function supplierSyncSnapshotSequenceFromRuns(
  runs: Array<Pick<SupplierSourceSyncRun, 'id'>>,
  runId: string,
): number | null {
  const index = runs.findIndex((run) => run.id === runId);
  return index >= 0 ? index + 1 : null;
}

export function isSuccessfulSupplierSyncRun(
  run: Pick<SupplierSourceSyncRun, 'status' | 'finishedAt'>,
): boolean {
  return (
    run.status === SupplierSourceSyncRunStatus.SUCCEEDED && run.finishedAt != null
  );
}
