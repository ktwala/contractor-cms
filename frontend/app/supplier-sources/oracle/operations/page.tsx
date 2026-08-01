'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import RequirePermission from '@/components/RequirePermission';
import OracleConnectorOperationsPanel from '@/components/supplier-sources/OracleConnectorOperationsPanel';
import { useAuth } from '@/lib/auth-context';
import { PERMISSIONS } from '@/lib/permissions.generated';
import { usesOracleSupplierConnector } from '@/lib/tenant-authority';

export default function OracleConnectorOperationsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const allowed = usesOracleSupplierConnector(user?.tenantAuthority);

  useEffect(() => {
    if (!loading && !allowed) {
      router.replace('/suppliers');
    }
  }, [loading, allowed, router]);

  if (loading || !allowed) {
    return (
      <DashboardLayout>
        <p className="text-sm text-gray-500">Loading…</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <RequirePermission permission={PERMISSIONS.SUPPLIERS.READ}>
        <OracleConnectorOperationsPanel />
      </RequirePermission>
    </DashboardLayout>
  );
}
