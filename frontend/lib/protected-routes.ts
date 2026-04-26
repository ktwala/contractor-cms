import { PERMISSIONS, Permission } from './permissions.generated';

export interface ProtectedRoute {
  path: string;
  name: string;
  permission: Permission | null; // null means authenticated but no specific permission required (e.g., Dashboard)
  showInSidebar?: boolean; // Default true, set to false to hide
}

export const PROTECTED_ROUTES: ProtectedRoute[] = [
  {
    path: '/dashboard',
    name: 'Dashboard',
    permission: null, // Any authenticated user can view the dashboard
  },
  {
    path: '/suppliers',
    name: 'Suppliers',
    permission: PERMISSIONS.SUPPLIERS.READ,
  },
  {
    path: '/contractors',
    name: 'Contractors',
    permission: PERMISSIONS.CONTRACTORS.READ,
  },
  {
    path: '/contracts',
    name: 'Contracts',
    permission: PERMISSIONS.CONTRACTS.READ,
  },
  {
    path: '/engagements',
    name: 'Engagements',
    permission: PERMISSIONS.ENGAGEMENTS.READ,
  },
  {
    path: '/timesheets',
    name: 'Timesheets',
    permission: PERMISSIONS.TIMESHEETS.READ,
  },
  {
    path: '/invoices',
    name: 'Invoices',
    permission: PERMISSIONS.INVOICES.READ,
  },
  {
    path: '/projects',
    name: 'Projects',
    permission: PERMISSIONS.PROJECTS.READ,
  },
  {
    path: '/withholding',
    name: 'Withholding',
    permission: PERMISSIONS.WITHHOLDING.READ,
  },
  {
    path: '/organizations',
    name: 'Organizations',
    permission: PERMISSIONS.ORGANIZATIONS.READ,
  },
  {
    path: '/settings/users',
    name: 'Users',
    permission: PERMISSIONS.USERS.READ,
  },
  {
    path: '/settings/users/[id]',
    name: 'User Details',
    permission: PERMISSIONS.USERS.READ,
    showInSidebar: false,
  },
  {
    path: '/settings/roles',
    name: 'Roles',
    permission: PERMISSIONS.ROLES.READ,
  },
  {
    path: '/settings/roles/new',
    name: 'Create Role',
    permission: PERMISSIONS.ROLES.CREATE,
    showInSidebar: false,
  },
  {
    path: '/settings/roles/[id]',
    name: 'Role Details',
    permission: PERMISSIONS.ROLES.READ,
    showInSidebar: false,
  },
];
