'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-layout';

function isPdpAlignedShell(pathname: string | null) {
  if (!pathname) return false;
  return (
    pathname.includes('/settings/pdp-activation') ||
    pathname.includes('/settings/pdp-exceptions')
  );
}

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (isPdpAlignedShell(pathname)) {
    return (
      <DashboardLayout>
        <div className="space-y-6">{children}</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage system administration settings including users and roles.
          </p>
        </div>
        <div className="bg-white shadow rounded-lg p-6">{children}</div>
      </div>
    </DashboardLayout>
  );
}
