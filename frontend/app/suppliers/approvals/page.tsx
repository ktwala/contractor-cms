'use client';

import DashboardLayout from '@/components/dashboard-layout';
import RequirePermission from '@/components/RequirePermission';
import SupplierApprovalsQueue from '@/components/suppliers/SupplierApprovalsQueue';
import { PERMISSIONS } from '@/lib/permissions.generated';

export default function SupplierApprovalsPage() {
  return (
    <RequirePermission
      permission={[PERMISSIONS.SUPPLIERS.APPROVE, PERMISSIONS.SUPPLIERS.SUSPEND]}
    >
      <DashboardLayout>
        <SupplierApprovalsQueue />
      </DashboardLayout>
    </RequirePermission>
  );
}
