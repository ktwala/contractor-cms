import { SupplierStatus, SupplierType } from '@prisma/client';
import {
  SUPPLIER_GOV_DEMO_PENDING_APPROVAL_REASON,
  SUPPLIER_GOV_DEMO_PENDING_EXTERNAL_ID,
} from '../demo/demo-supplier-governance.constants';

export function resolveSupplierApprovalWaitingReason(input: {
  type: SupplierType;
  externalSupplierId?: string | null;
}): string {
  if (input.externalSupplierId === SUPPLIER_GOV_DEMO_PENDING_EXTERNAL_ID) {
    return SUPPLIER_GOV_DEMO_PENDING_APPROVAL_REASON;
  }

  return 'Operational Trust review required before supplier can participate in EWP';
}

export { shouldApplyDemoGovernanceStatus } from '../demo/demo-supplier-governance.constants';
