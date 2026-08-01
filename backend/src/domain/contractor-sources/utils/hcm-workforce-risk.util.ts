import { isActiveAssignmentStatus } from '../../contractor-migration/constants/hcm-worker-types';

export function isUpstreamWorkforceTerminated(
  normalized: unknown,
): boolean {
  if (!normalized || typeof normalized !== 'object') {
    return false;
  }
  const record = normalized as {
    assignmentStatus?: string | null;
    endDate?: string | null;
  };

  if (record.assignmentStatus && !isActiveAssignmentStatus(record.assignmentStatus)) {
    return true;
  }

  if (record.endDate) {
    const end = new Date(record.endDate);
    if (!Number.isNaN(end.getTime()) && end.getTime() < Date.now()) {
      return true;
    }
  }

  return false;
}
