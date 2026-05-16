'use client';

import { useAuth } from '@/lib/auth-context';
import AnalyticsDashboard from '@/components/dashboard/AnalyticsDashboard';
import PermissionAwareDashboard from '@/components/dashboard/PermissionAwareDashboard';
import DashboardLayout from '@/components/dashboard-layout';
import { PERMISSIONS } from '@/lib/permissions.generated';

export default function DashboardPage() {
  const { user, can } = useAuth();

  if (!user) return null;

  if (can(PERMISSIONS.ANALYTICS.READ)) {
    return (
      <DashboardLayout>
        <AnalyticsDashboard />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PermissionAwareDashboard />
    </DashboardLayout>
  );
}
