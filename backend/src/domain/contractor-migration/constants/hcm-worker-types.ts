/** Oracle HCM worker types accepted as external contractors for migration wave 1. */
export const SUPPORTED_HCM_WORKER_TYPES = new Set(
  [
    'contractor',
    'contingent worker',
    'contingent_worker',
    'contingentworker',
    'external contractor',
    'cwk',
    'contractor / contingent worker',
  ].map((s) => s.toLowerCase()),
);

export const SUPPORTED_ASSIGNMENT_STATUSES = new Set(
  ['active', 'inactive', 'terminated', 'ended', 'suspended'].map((s) =>
    s.toLowerCase(),
  ),
);

export function isActiveAssignmentStatus(status: string | null): boolean {
  if (!status) return true;
  const normalized = status.trim().toLowerCase();
  return normalized === 'active' || normalized === '';
}
