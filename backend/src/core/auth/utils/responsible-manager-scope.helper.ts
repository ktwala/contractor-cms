import { AccessContext } from '../interfaces/access-context.interface';

/** Filter engagements where the actor is primary or delegate business sponsor. */
export function buildResponsibleManagerEngagementFilter(
  accessContext: AccessContext,
): Record<string, unknown> | null {
  if (!accessContext.responsibleManagerEmployeeId) {
    return null;
  }
  const ref = accessContext.responsibleManagerEmployeeId;
  return {
    OR: [{ responsibleManagerEmployeeId: ref }, { responsibleManagerDelegateEmployeeId: ref }],
  };
}

/** Restrict engagement list/read queries to sponsorship assignments (PR-SPONSOR-DOCTRINE-REALIGN-1). */
export function applyResponsibleManagerEngagementScope(
  where: Record<string, unknown>,
  accessContext: AccessContext,
): void {
  const filter = buildResponsibleManagerEngagementFilter(accessContext);
  if (!filter) {
    return;
  }
  const existingAnd = where.AND;
  const andList = Array.isArray(existingAnd)
    ? [...existingAnd]
    : existingAnd
      ? [existingAnd]
      : [];
  andList.push(filter);
  where.AND = andList;
}

/** Restrict contractor queries to rows with at least one sponsored engagement. */
export function applyResponsibleManagerContractorScope(
  where: Record<string, unknown>,
  accessContext: AccessContext,
): void {
  const filter = buildResponsibleManagerEngagementFilter(accessContext);
  if (!filter) {
    return;
  }
  const existingEngagements = where.engagements as Record<string, unknown> | undefined;
  where.engagements = {
    ...existingEngagements,
    some: filter,
  };
}
