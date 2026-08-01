'use client';

import DashboardLayout from '@/components/dashboard-layout';
import RequirePermission from '@/components/RequirePermission';
import OperationalTrustManagement from '@/components/suppliers/OperationalTrustManagement';
import { PERMISSIONS } from '@/lib/permissions.generated';

export default function OperationalTrustManagementPage() {
  return (
    <RequirePermission
      permission={[PERMISSIONS.SUPPLIERS.APPROVE, PERMISSIONS.SUPPLIERS.SUSPEND]}
    >
      <DashboardLayout>
        <OperationalTrustManagement />
      </DashboardLayout>
    </RequirePermission>
  );
}
