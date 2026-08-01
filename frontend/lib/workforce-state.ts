/** PR-WORKFORCE-NOMINATE-1 / PR-SUPPLIER-PORTAL-WORKFORCE-NOMINATE-1 — display labels only. */
export const WORKFORCE_STATE_LABELS: Record<string, string> = {
  NOMINATED: 'Nominated',
  PENDING_APPROVAL: 'Pending approval',
  ACTIVE: 'Active',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
  TERMINATED: 'Terminated',
  BLACKLISTED: 'Blacklisted',
};

export function formatWorkforceState(state?: string | null): string {
  if (!state) return '—';
  return WORKFORCE_STATE_LABELS[state] ?? state.replace(/_/g, ' ');
}

export function workforceStateBadgeClass(state?: string | null): string {
  switch (state) {
    case 'NOMINATED':
      return 'bg-blue-50 text-blue-700';
    case 'PENDING_APPROVAL':
      return 'bg-amber-50 text-amber-800';
    case 'ACTIVE':
      return 'bg-green-50 text-green-700';
    case 'REJECTED':
      return 'bg-rose-50 text-rose-800';
    case 'SUSPENDED':
      return 'bg-orange-50 text-orange-800';
    case 'TERMINATED':
      return 'bg-gray-100 text-gray-700';
    case 'BLACKLISTED':
      return 'bg-red-50 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}
