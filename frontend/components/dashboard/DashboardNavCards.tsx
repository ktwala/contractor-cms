'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { filterDashboardModules } from '@/lib/dashboard-modules';
import {
  filterSupplierPortalModules,
  isSupplierPortalUser,
} from '@/lib/supplier-portal-modules';

export default function DashboardNavCards() {
  const { can, user } = useAuth();
  const modules = isSupplierPortalUser(can)
    ? filterSupplierPortalModules(can)
    : filterDashboardModules(can, user, user?.tenantAuthority);

  if (modules.length === 0) {
    return (
      <p className="text-sm text-content-muted">
        No module shortcuts available for your current permissions.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {modules.map((mod) => {
        const Icon = mod.icon;
        return (
          <Link key={mod.id} href={mod.href} className="block">
            <div
              className={`card hover:shadow-md transition-shadow cursor-pointer h-full border-l-4 ${mod.borderClass}`}
            >
              <div className="flex items-center space-x-4">
                <div className={`p-3 rounded-lg ${mod.iconBgClass}`}>
                  <Icon className={`w-6 h-6 ${mod.iconClass}`} />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-content">{mod.title}</h3>
                  <p className="text-sm text-content-muted">{mod.description}</p>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
