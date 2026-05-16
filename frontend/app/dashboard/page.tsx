'use client';

import { useAuth } from '@/lib/auth-context';
import AnalyticsDashboard from '@/components/dashboard/AnalyticsDashboard';
import ContractorDashboard from '@/components/dashboard/ContractorDashboard';
import OperationalDashboard from '@/components/dashboard/OperationalDashboard';
import FinanceDashboard from '@/components/dashboard/FinanceDashboard';
import DashboardLayout from '@/components/dashboard-layout';

export default function DashboardPage() {
  const { user, can } = useAuth();

  if (!user) return null;

  // 1. If the user has explicitly been granted analytics:read, show the full analytics dashboard
  if (can('analytics:read' as any)) {
    return (
      <DashboardLayout>
        <AnalyticsDashboard />
      </DashboardLayout>
    );
  }

  // 2. If the user is a CONTRACTOR, show the self-service workspace
  // Check if they have the CONTRACTOR role
  const isContractor = user.roles?.some((r: any) => 
    typeof r === 'object' ? r.name === 'CONTRACTOR' : r === 'CONTRACTOR'
  );
  
  if (isContractor) {
    return (
      <DashboardLayout>
        <ContractorDashboard />
      </DashboardLayout>
    );
  }

  // 3. If the user is a FINANCE_USER, show the finance workspace
  const isFinance = user.roles?.some((r: any) => 
    typeof r === 'object' ? r.name === 'FINANCE_USER' : r === 'FINANCE_USER'
  );

  if (isFinance) {
    return (
      <DashboardLayout>
        <FinanceDashboard />
      </DashboardLayout>
    );
  }

  // 4. Fallback for internal operational users (e.g. CONTRACTOR_MANAGER) who lack analytics access
  return (
    <DashboardLayout>
      <OperationalDashboard />
    </DashboardLayout>
  );
}
