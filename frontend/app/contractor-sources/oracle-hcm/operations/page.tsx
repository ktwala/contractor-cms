'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import RequirePermission from '@/components/RequirePermission';
import HcmConnectorOperationsPanel from '@/components/contractor-sources/HcmConnectorOperationsPanel';
import { useAuth } from '@/lib/auth-context';
import { PERMISSIONS } from '@/lib/permissions.generated';
import { usesHcmContractorConnector } from '@/lib/tenant-authority';

export default function HcmConnectorOperationsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const allowed = usesHcmContractorConnector(user?.tenantAuthority);

  useEffect(() => {
    if (!loading && !allowed) {
      router.replace('/contractors');
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
      <RequirePermission permission={PERMISSIONS.CONTRACTOR_MIGRATION.READ}>
        <HcmConnectorOperationsPanel />
      </RequirePermission>
    </DashboardLayout>
  );
}
