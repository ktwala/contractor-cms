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
  Menu,
  X,
  Shield,
  ScrollText,
  ShieldCheck,
  ClipboardList,
  RefreshCw,
  CloudDownload,
  LogOut,
} from 'lucide-react';
import { HubsecBrand } from '@/components/ui/hubsec-brand';
import { Button } from '@/components/ui/button';
import {
  PROTECTED_ROUTES,
  isRouteAllowed,
  NAV_GROUP_ORDER,
  NAV_GROUP_LABELS,
  type NavGroup,
} from '@/lib/protected-routes';
import type { Permission } from '@/lib/permissions.generated';
import { isHcmLinkedResponsibleManagerView } from '@/lib/business-responsible-manager';
import {
  usesHcmContractorConnector,
  usesOracleSupplierConnector,
} from '@/lib/tenant-authority';
import {
  isSupplierPortalRoute,
  resolveNavShell,
  type NavShellOptions,
} from '@/lib/nav-shell-context';

// Map icons to routes
const ICON_MAP: Record<string, React.ElementType> = {
  '/dashboard': LayoutDashboard,
  '/suppliers': Users,
  '/suppliers/approvals': ClipboardList,
  '/suppliers/operational-trust': ClipboardList,
  '/supplier-sources/oracle/operations': CloudDownload,
  '/contractor-sources/oracle-hcm/operations': CloudDownload,
  '/supplier-portal/profile': Building2,
  '/supplier-portal/contractors': Users,
  '/supplier-portal/timesheets': Clock,
  '/supplier-portal/invoices': FileText,
  '/contractors': Users,
  '/contractors/workforce-review': ClipboardList,
  '/contracts': FileText,
  '/engagements': Briefcase,
  '/responsible-manager-tasks': ClipboardList,
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
          {label ? (
            <p
              className="sidebar-section-label"
              data-testid={`nav-section-label-${group}`}
            >
              {label}
            </p>
          ) : null}
          <div className="space-y-1">
            {items.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  href={item.href}
                  className={
                    isActive ? 'sidebar-nav-link sidebar-nav-link-active' : 'sidebar-nav-link'
                  }
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

/** PR-NAV-IA-1 / PR-SHELL-NAV-CONTEXT-1 — grouped nav from route table + actor shell context. */
export function buildSidebarNavSections(
  can: (permission: Permission) => boolean,
  pathname?: string | null,
  sponsorViewUser?: {
    externalId?: string | null;
    responsibleManagerAccountabilityInboxEnabled?: boolean;
    tenantAuthority?: { supplierAuthorityMode?: string } | null;
  } | null,
  navOptions?: NavShellOptions,
): SidebarNavSection[] {
  const navShell = resolveNavShell(can, navOptions);
  const businessSponsor = isHcmLinkedResponsibleManagerView(sponsorViewUser, can);
  const inboxEnabled = sponsorViewUser?.responsibleManagerAccountabilityInboxEnabled === true;

  const routeTable = PROTECTED_ROUTES.filter((route) => {
    if (navShell === 'supplier-portal') {
      return route.path === '/dashboard' || isSupplierPortalRoute(route.path);
    }
    return !isSupplierPortalRoute(route.path);
  });

  const oracleConnector = usesOracleSupplierConnector(
    sponsorViewUser?.tenantAuthority as Parameters<typeof usesOracleSupplierConnector>[0],
  );
  const hcmConnector = usesHcmContractorConnector(
    sponsorViewUser?.tenantAuthority as Parameters<typeof usesHcmContractorConnector>[0],
  );

  const items: SidebarNavItem[] = routeTable.filter((route) => {
    if (route.showInSidebar === false) return false;
    if (route.requiresSponsorInbox && !inboxEnabled) return false;
    if (route.requiresOracleConnector && !oracleConnector) return false;
    if (route.requiresHcmConnector && !hcmConnector) return false;
    return isRouteAllowed(route.permission, can);
  }).map((route) => ({
    path: route.path,
    href: route.path,
    name:
      businessSponsor && route.businessSponsorName
        ? route.businessSponsorName
        : route.name,
    navGroup: route.navGroup,
    icon: ICON_MAP[route.path] || FileText,
  }));

  return NAV_GROUP_ORDER.map((group) => ({
    group,
    label: NAV_GROUP_LABELS[group],
    items: items.filter((i) => i.navGroup === group),
  })).filter((s) => s.items.length > 0);
}

function userInitials(user: { firstName?: string; lastName?: string; email?: string }) {
  const first = user.firstName?.trim().charAt(0) ?? '';
  const last = user.lastName?.trim().charAt(0) ?? '';
  if (first || last) return `${first}${last}`.toUpperCase();
  return (user.email?.charAt(0) ?? '?').toUpperCase();
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, can, refreshProfile } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshingPermissions, setRefreshingPermissions] = useState(false);

  const handleRefreshPermissions = async () => {
    setRefreshingPermissions(true);
    try {
      await refreshProfile();
    } finally {
      setRefreshingPermissions(false);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const groupedSections = useMemo(
    () => buildSidebarNavSections(can, pathname, user),
    [can, pathname, user],
  );

  const navShell = useMemo(() => resolveNavShell(can), [can]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page">
        <div className="text-content-muted">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-page">
      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-slate-900/60" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 flex flex-col w-64 sidebar-shell">
            <div className="sidebar-header justify-between">
              <HubsecBrand />
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="text-sidebar-text hover:text-white"
                aria-label="Close menu"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <nav
              className="flex-1 px-4 py-4 overflow-y-auto"
              data-testid={`nav-shell-${navShell}`}
            >
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
        <div className="sidebar-shell">
          <div className="sidebar-header">
            <HubsecBrand />
          </div>
          <nav
            className="flex-1 px-4 py-4 overflow-y-auto"
            data-testid={`nav-shell-${navShell}`}
          >
            <SidebarNavSections sections={groupedSections} pathname={pathname} />
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        <header className="app-topbar">
          <div className="flex items-center gap-1 pl-3 sm:pl-4">
            <button
              type="button"
              className="app-topbar-menu"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
              data-testid="topbar-menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-1 items-center justify-end gap-3 px-4 sm:px-6">
            <Button
              variant="toolbar"
              onClick={handleRefreshPermissions}
              loading={refreshingPermissions}
              icon={<RefreshCw className="h-4 w-4" />}
              data-testid="refresh-permissions"
            >
              Refresh permissions
            </Button>

            <div className="hidden h-8 w-px bg-card-border sm:block" aria-hidden />

            <div className="flex items-center gap-3">
              <div
                className="app-topbar-avatar"
                title={`${user.firstName} ${user.lastName}`}
                data-testid="topbar-avatar"
              >
                {userInitials(user)}
              </div>
              <div className="hidden min-w-0 md:block">
                <p className="truncate text-sm font-medium text-content">
                  {user.firstName} {user.lastName}
                </p>
                <p className="truncate text-xs text-content-muted">{user.email}</p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="app-topbar-menu"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="app-main">
          <div className="app-main-inner">{children}</div>
        </main>
      </div>
    </div>
  );
}
