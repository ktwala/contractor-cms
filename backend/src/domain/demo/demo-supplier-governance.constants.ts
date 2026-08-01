/**
 * Supplier governance demo — materialized after supplier readiness assessment (DEMO_MODE).
 * See docs/DEMO-MTN-STORY.md and Supplier Synchronization Governance tab.
 */

import { SupplierStatus } from '@prisma/client';
import { MTN_DEMO_SUPPLIERS } from './demo-mtn-story.constants';

export const SUPPLIER_GOV_DEMO_ACTIVE_EXTERNAL_IDS = [
  'ORCL-SUP-MTN-001',
  'ORCL-SUP-MTN-002',
  'ORCL-SUP-MTN-004',
] as const;

export const SUPPLIER_GOV_DEMO_SUSPENDED_EXTERNAL_ID = 'ORCL-SUP-MTN-003';
export const SUPPLIER_GOV_DEMO_PENDING_EXTERNAL_ID = 'ORCL-SUP-MTN-005';

export const SUPPLIER_GOV_DEMO_EXPECTED_COUNTS = {
  synchronizedSuppliers: 5,
  governedActive: SUPPLIER_GOV_DEMO_ACTIVE_EXTERNAL_IDS.length,
  suspended: 1,
  pendingApproval: 1,
  hcmReconciliationWorkItems: 2,
} as const;

export function mtnSupplierTradingName(externalSupplierId: string): string {
  return (
    MTN_DEMO_SUPPLIERS.find((s) => s.externalSupplierId === externalSupplierId)?.tradingName ??
    externalSupplierId
  );
}

/** MTN demo — why Horizon awaits Operational Trust after Oracle procurement approval. */
export const SUPPLIER_GOV_DEMO_PENDING_APPROVAL_REASON =
  'Supplier is approved in Oracle Procurement but has not yet been enabled for participation in the External Workforce Platform.';

/**
 * Demo materialization may set initial lifecycle roles but must never undo operator decisions.
 */
export function shouldApplyDemoGovernanceStatus(
  current: SupplierStatus,
  target: SupplierStatus,
): boolean {
  if (current === target) {
    return false;
  }
  if (current === SupplierStatus.ACTIVE && target === SupplierStatus.PENDING_APPROVAL) {
    return false;
  }
  if (current === SupplierStatus.SUSPENDED && target !== SupplierStatus.SUSPENDED) {
    return false;
  }
  return true;
}
