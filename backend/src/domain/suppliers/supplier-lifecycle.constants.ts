import { SupplierStatus } from '@prisma/client';
import { PERMISSIONS } from '../../core/auth/permissions.constants';

/** PR-CMS-OPERATIONS-1A — supplier lifecycle (not contractor TERMINATED). */
export const SUPPLIER_LIFECYCLE_STATUSES = [
  SupplierStatus.DRAFT,
  SupplierStatus.PENDING_APPROVAL,
  SupplierStatus.ACTIVE,
  SupplierStatus.SUSPENDED,
  SupplierStatus.OFFBOARDED,
  SupplierStatus.ARCHIVED,
] as const;

export const INVALID_SUPPLIER_STATUS_TRANSITION = 'INVALID_SUPPLIER_STATUS_TRANSITION';
export const SUPPLIER_SELF_APPROVAL_FORBIDDEN = 'SUPPLIER_SELF_APPROVAL_FORBIDDEN';
export const SUPPLIER_TRANSITION_REASON_REQUIRED = 'SUPPLIER_TRANSITION_REASON_REQUIRED';

/** Allowed transitions (from → to). */
export const SUPPLIER_STATUS_TRANSITIONS: Readonly<
  Partial<Record<SupplierStatus, readonly SupplierStatus[]>>
> = {
  [SupplierStatus.DRAFT]: [SupplierStatus.PENDING_APPROVAL],
  [SupplierStatus.PENDING_APPROVAL]: [
    SupplierStatus.ACTIVE,
    SupplierStatus.SUSPENDED,
  ],
  [SupplierStatus.ACTIVE]: [SupplierStatus.SUSPENDED, SupplierStatus.OFFBOARDED],
  [SupplierStatus.SUSPENDED]: [SupplierStatus.ACTIVE, SupplierStatus.OFFBOARDED],
  [SupplierStatus.OFFBOARDED]: [SupplierStatus.ARCHIVED],
  [SupplierStatus.ARCHIVED]: [],
};

export type SupplierTransitionPermission =
  | typeof PERMISSIONS.SUPPLIERS.SUBMIT_FOR_APPROVAL
  | typeof PERMISSIONS.SUPPLIERS.APPROVE
  | typeof PERMISSIONS.SUPPLIERS.SUSPEND
  | typeof PERMISSIONS.SUPPLIERS.OFFBOARD
  | typeof PERMISSIONS.SUPPLIERS.ARCHIVE;

export function requiredPermissionForTransition(
  from: SupplierStatus,
  to: SupplierStatus,
): SupplierTransitionPermission {
  if (from === SupplierStatus.DRAFT && to === SupplierStatus.PENDING_APPROVAL) {
    return PERMISSIONS.SUPPLIERS.SUBMIT_FOR_APPROVAL;
  }
  if (to === SupplierStatus.ACTIVE) {
    return PERMISSIONS.SUPPLIERS.APPROVE;
  }
  if (to === SupplierStatus.SUSPENDED && from === SupplierStatus.PENDING_APPROVAL) {
    return PERMISSIONS.SUPPLIERS.SUSPEND;
  }
  if (to === SupplierStatus.SUSPENDED) {
    return PERMISSIONS.SUPPLIERS.SUSPEND;
  }
  if (to === SupplierStatus.OFFBOARDED) {
    return PERMISSIONS.SUPPLIERS.OFFBOARD;
  }
  if (to === SupplierStatus.ARCHIVED) {
    return PERMISSIONS.SUPPLIERS.ARCHIVE;
  }
  throw new Error(`No permission mapping for ${from} → ${to}`);
}

export type SupplierLifecycleAuditAction =
  | 'SUPPLIER_STATUS_CHANGED'
  | 'SUPPLIER_SUBMITTED_FOR_APPROVAL'
  | 'SUPPLIER_APPROVED'
  | 'SUPPLIER_REJECTED'
  | 'SUPPLIER_SUSPENDED'
  | 'SUPPLIER_OFFBOARDED'
  | 'SUPPLIER_ARCHIVED';

export function auditActionForTransition(
  from: SupplierStatus,
  to: SupplierStatus,
): SupplierLifecycleAuditAction[] {
  const events: SupplierLifecycleAuditAction[] = ['SUPPLIER_STATUS_CHANGED'];

  if (from === SupplierStatus.DRAFT && to === SupplierStatus.PENDING_APPROVAL) {
    events.push('SUPPLIER_SUBMITTED_FOR_APPROVAL');
  } else if (
    (from === SupplierStatus.PENDING_APPROVAL || from === SupplierStatus.SUSPENDED) &&
    to === SupplierStatus.ACTIVE
  ) {
    // Grant and restore both produce Operational Trust Granted audit evidence.
    events.push('SUPPLIER_APPROVED');
  } else if (from === SupplierStatus.PENDING_APPROVAL && to === SupplierStatus.SUSPENDED) {
    events.push('SUPPLIER_REJECTED');
  } else if (to === SupplierStatus.SUSPENDED) {
    events.push('SUPPLIER_SUSPENDED');
  } else if (to === SupplierStatus.OFFBOARDED) {
    events.push('SUPPLIER_OFFBOARDED');
  } else if (to === SupplierStatus.ARCHIVED) {
    events.push('SUPPLIER_ARCHIVED');
  }

  return events;
}

export function isSupplierApprovalTransition(
  from: SupplierStatus,
  to: SupplierStatus,
): boolean {
  return (
    (from === SupplierStatus.PENDING_APPROVAL && to === SupplierStatus.ACTIVE) ||
    (from === SupplierStatus.SUSPENDED && to === SupplierStatus.ACTIVE)
  );
}
