import { ContractorSourceSyncRun, ContractorSourceSyncRunStatus } from '@prisma/client';

/** User-facing discovery snapshot label, e.g. DISC-00015 */
export function formatDiscoverySnapshotRef(sequence: number): string {
  return `DISC-${String(sequence).padStart(5, '0')}`;
}

export function discoverySnapshotSequenceFromRuns(
  runs: Array<Pick<ContractorSourceSyncRun, 'id'>>,
  runId: string,
): number | null {
  const index = runs.findIndex((run) => run.id === runId);
  return index >= 0 ? index + 1 : null;
}

export function isSuccessfulDiscoveryRun(
  run: Pick<ContractorSourceSyncRun, 'status' | 'finishedAt'>,
): boolean {
  return (
    run.status === ContractorSourceSyncRunStatus.SUCCEEDED && run.finishedAt != null
  );
}
