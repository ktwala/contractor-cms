import { PERMISSIONS, Permission } from './permissions.generated';

/** PR-NAV-IA-1 — sidebar segmentation (group headings only; access still from `permission`). */
export type NavGroup = 'operations' | 'governance' | 'administration';

export const NAV_GROUP_ORDER: NavGroup[] = [
  'operations',
  'governance',
  'administration',
];

export const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  operations: 'Operations',
  governance: 'Governance',
  administration: 'Administration',
};

export type RoutePermission = Permission | Permission[] | null;

export interface ProtectedRoute {
  path: string;
  name: string;
  /** null = any authenticated user; array = any listed permission (OR). */
  permission: RoutePermission;
  showInSidebar?: boolean; // Default true, set to false to hide
  /** Sidebar section heading (PR-NAV-IA-1); ignored when `showInSidebar === false`. */
  navGroup: NavGroup;
}

export function isRouteAllowed(
  permission: RoutePermission,
  can: (p: Permission) => boolean,
): boolean {
  if (!permission) return true;
  if (Array.isArray(permission)) {
    return permission.some((p) => can(p));
  }
  return can(permission);
}

export const PROTECTED_ROUTES: ProtectedRoute[] = [
  {
    path: '/dashboard',
    name: 'Dashboard',
    permission: null, // Any authenticated user can view the dashboard
    navGroup: 'operations',
  },
  {
    path: '/suppliers',
    name: 'Suppliers',
    permission: [PERMISSIONS.SUPPLIERS.READ, PERMISSIONS.SUPPLIER_PROFILE.READ],
    navGroup: 'operations',
  },
  {
    path: '/contractors',
    name: 'Contractors',
    permission: PERMISSIONS.CONTRACTORS.READ,
    navGroup: 'operations',
  },
  {
    path: '/contracts',
    name: 'Contracts',
    permission: PERMISSIONS.CONTRACTS.READ,
    navGroup: 'operations',
  },
  {
    path: '/engagements',
    name: 'Engagements',
    permission: PERMISSIONS.ENGAGEMENTS.READ,
    navGroup: 'operations',
  },
  {
    path: '/timesheets',
    name: 'Timesheets',
    permission: [PERMISSIONS.TIMESHEETS.READ, PERMISSIONS.SUPPLIER_TIMESHEETS.READ],
    navGroup: 'operations',
  },
  {
    path: '/invoices',
    name: 'Invoices',
    permission: PERMISSIONS.INVOICES.READ,
    navGroup: 'operations',
  },
  {
    path: '/projects',
    name: 'Projects',
    permission: PERMISSIONS.PROJECTS.READ,
    navGroup: 'operations',
  },
  {
    path: '/settings/users',
    name: 'Users',
    permission: PERMISSIONS.USERS.READ,
    navGroup: 'administration',
  },
  {
    path: '/settings/users/[id]',
    name: 'User Details',
    permission: PERMISSIONS.USERS.READ,
    showInSidebar: false,
    navGroup: 'administration',
  },
  {
    path: '/settings/roles',
    name: 'Roles',
    permission: PERMISSIONS.ROLES.READ,
    navGroup: 'administration',
  },
  {
    path: '/settings/roles/new',
    name: 'Create Role',
    permission: PERMISSIONS.ROLES.CREATE,
    showInSidebar: false,
    navGroup: 'administration',
  },
  {
    path: '/settings/roles/[id]',
    name: 'Role Details',
    permission: PERMISSIONS.ROLES.READ,
    showInSidebar: false,
    navGroup: 'administration',
  },
  {
    path: '/settings/audit-logs',
    name: 'Audit Logs',
    permission: PERMISSIONS.AUDIT.READ,
    navGroup: 'governance',
  },
  {
    path: '/settings/pdp-activation',
    name: 'Governance Activation',
    permission: PERMISSIONS.PDP_ACTIVATION.VIEW,
    navGroup: 'governance',
  },
  {
    path: '/settings/pdp-exceptions',
    name: 'Governance Exceptions',
    permission: PERMISSIONS.PDP_EXCEPTIONS.VIEW,
    navGroup: 'governance',
  },
  {
    path: '/settings/audit-insights',
    name: 'Security Insights',
    permission: PERMISSIONS.AUDIT.READ,
    navGroup: 'governance',
  },
];
