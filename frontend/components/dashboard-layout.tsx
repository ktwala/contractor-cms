'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  FileText,
  Briefcase,
  Clock,
  Receipt,
  FolderKanban,
  FileSpreadsheet,
  Building2,
  LogOut,
  Menu,
  X,
  Shield,
  ScrollText,
  ShieldCheck,
} from 'lucide-react';
import {
  PROTECTED_ROUTES,
  isRouteAllowed,
  NAV_GROUP_ORDER,
  NAV_GROUP_LABELS,
  type NavGroup,
} from '@/lib/protected-routes';
import type { Permission } from '@/lib/permissions.generated';

// Map icons to routes
const ICON_MAP: Record<string, React.ElementType> = {
  '/dashboard': LayoutDashboard,
  '/suppliers': Users,
  '/supplier-portal/profile': Building2,
  '/supplier-portal/contractors': Users,
  '/supplier-portal/timesheets': Clock,
  '/contractors': Users,
  '/contracts': FileText,
  '/engagements': Briefcase,
  '/timesheets': Clock,
  '/invoices': Receipt,
  '/projects': FolderKanban,
  '/withholding': FileSpreadsheet,
  '/organizations': Building2,
  '/settings/users': Users,
  '/settings/roles': Shield,
  '/settings/audit-logs': ScrollText,
  '/settings/pdp-activation': Shield,
  '/settings/pdp-exceptions': ShieldCheck,
  '/settings/audit-insights': ShieldCheck,
};

export type SidebarNavItem = {
  path: string;
  href: string;
  name: string;
  navGroup: NavGroup;
  icon: React.ElementType;
};

export type SidebarNavSection = {
  group: NavGroup;
  label: string;
  items: SidebarNavItem[];
};

function SidebarNavSections({
  sections,
  pathname,
  onLinkClick,
}: {
  sections: SidebarNavSection[];
  pathname: string;
  onLinkClick?: () => void;
}) {
  return (
    <>
      {sections.map(({ group, label, items }, sectionIdx) => (
        <div
          key={group}
          className={sectionIdx > 0 ? 'mt-4' : ''}
          data-testid={`nav-section-${group}`}
        >
          <p
            className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-400"
            data-testid={`nav-section-label-${group}`}
          >
            {label}
          </p>
          <div className="space-y-1">
            {items.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  href={item.href}
                  className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg ${
                    isActive
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  onClick={onLinkClick}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

const SUPPLIER_PORTAL_PATH_PREFIX = '/supplier-portal';

/** PR-NAV-IA-1 — build grouped nav from route table + permission filter (pure; testable). */
export function buildSidebarNavSections(
  can: (permission: Permission) => boolean,
  pathname?: string | null,
): SidebarNavSection[] {
  const onSupplierPortal = pathname?.startsWith(SUPPLIER_PORTAL_PATH_PREFIX) ?? false;

  const routeTable = onSupplierPortal
    ? PROTECTED_ROUTES.filter(
        (route) =>
          route.path === '/dashboard' || route.path.startsWith(SUPPLIER_PORTAL_PATH_PREFIX),
      )
    : PROTECTED_ROUTES;

  const items: SidebarNavItem[] = routeTable.filter((route) => {
    if (route.showInSidebar === false) return false;
    return isRouteAllowed(route.permission, can);
  }).map((route) => ({
    path: route.path,
    href: route.path,
    name: route.name,
    navGroup: route.navGroup,
    icon: ICON_MAP[route.path] || FileText,
  }));

  return NAV_GROUP_ORDER.map((group) => ({
    group,
    label: NAV_GROUP_LABELS[group],
    items: items.filter((i) => i.navGroup === group),
  })).filter((s) => s.items.length > 0);
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, can } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const groupedSections = useMemo(
    () => buildSidebarNavSections(can, pathname),
    [can, pathname],
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 flex flex-col w-64 bg-white">
            <div className="flex items-center justify-between h-16 px-4 border-b">
              <span className="text-xl font-bold text-primary-600">Contractor CMS</span>
              <button type="button" onClick={() => setSidebarOpen(false)} className="text-gray-500">
                <X className="w-6 h-6" />
              </button>
            </div>
            <nav className="flex-1 px-4 py-4 overflow-y-auto">
              <SidebarNavSections
                sections={groupedSections}
                pathname={pathname}
                onLinkClick={() => setSidebarOpen(false)}
              />
            </nav>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-1 min-h-0 bg-white border-r">
          <div className="flex items-center h-16 px-4 border-b">
            <span className="text-xl font-bold text-primary-600">Contractor CMS</span>
          </div>
          <nav className="flex-1 px-4 py-4 overflow-y-auto">
            <SidebarNavSections sections={groupedSections} pathname={pathname} />
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        <div className="sticky top-0 z-10 flex h-16 bg-white border-b">
          <button
            type="button"
            className="px-4 text-gray-500 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex items-center justify-between flex-1 px-4">
            <div />
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-700">
                {user.firstName} {user.lastName}
              </div>
              <button
                type="button"
                onClick={logout}
                className="text-gray-500 hover:text-gray-700"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <main className="py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
