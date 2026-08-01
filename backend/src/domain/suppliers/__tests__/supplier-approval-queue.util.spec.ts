import { SupplierStatus } from '@prisma/client';
import { shouldApplyDemoGovernanceStatus } from '../../demo/demo-supplier-governance.constants';
import { resolveSupplierApprovalWaitingReason } from '../supplier-approval-queue.util';

describe('shouldApplyDemoGovernanceStatus', () => {
  it('never reverts operator approval back to pending', () => {
    expect(
      shouldApplyDemoGovernanceStatus(
        SupplierStatus.ACTIVE,
        SupplierStatus.PENDING_APPROVAL,
      ),
    ).toBe(false);
  });

  it('allows initial demo materialization from pending to active', () => {
    expect(
      shouldApplyDemoGovernanceStatus(
        SupplierStatus.PENDING_APPROVAL,
        SupplierStatus.ACTIVE,
      ),
    ).toBe(true);
  });

  it('preserves operator suspension', () => {
    expect(
      shouldApplyDemoGovernanceStatus(
        SupplierStatus.SUSPENDED,
        SupplierStatus.ACTIVE,
      ),
    ).toBe(false);
  });
});

describe('resolveSupplierApprovalWaitingReason', () => {
  it('returns MTN Horizon demo reason for pending external id', () => {
    expect(
      resolveSupplierApprovalWaitingReason({
        type: 'COMPANY',
        externalSupplierId: 'ORCL-SUP-MTN-005',
      }),
    ).toContain('Oracle Procurement');
  });
});
