'use client';

import DashboardLayout from '@/components/dashboard-layout';
import RequirePermission from '@/components/RequirePermission';
import ContractorWorkforceReviewQueue from '@/components/contractors/ContractorWorkforceReviewQueue';
import { PERMISSIONS } from '@/lib/permissions.generated';

export default function ContractorWorkforceReviewPage() {
  return (
    <RequirePermission permission={PERMISSIONS.CONTRACTORS.READ}>
      <DashboardLayout>
        <ContractorWorkforceReviewQueue />
      </DashboardLayout>
    </RequirePermission>
  );
}
