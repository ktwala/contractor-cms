import { PERMISSIONS, Permission } from './permissions.generated';
import {
  CAPABILITY_NAV_LABELS,
  EXTERNAL_WORKFORCE_LABELS,
  GOVERNANCE_NAV_LABELS,
} from './external-workforce-labels';
import { SUPPLIER_SYNCHRONIZATION_LABELS } from './supplier-synchronization-labels';
import { SUPPLIER_PORTAL_CONTRACTOR_READ } from './supplier-portal-permissions';

/** PR-NAV-CAPABILITY-IA-2 — sidebar follows capability map (access still from `permission`). */
export type NavGroup =
  | 'overview'
  | 'supplierAdministration'
  | 'workforceAdministration'
  | 'engagementAdministration'
  | 'supplierPortal'
  | 'governance'
  | 'administration';

export const NAV_GROUP_ORDER: NavGroup[] = [
  'overview',
  'supplierAdministration',
  'workforceAdministration',
  'engagementAdministration',
  'supplierPortal',
  'governance',
  'administration',
];

export const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  overview: '',
  supplierAdministration: CAPABILITY_NAV_LABELS.supplierAdministration,
  workforceAdministration: CAPABILITY_NAV_LABELS.workforceAdministration,
  engagementAdministration: CAPABILITY_NAV_LABELS.engagementAdministration,
  supplierPortal: CAPABILITY_NAV_LABELS.supplierPortal,
  governance: CAPABILITY_NAV_LABELS.governance,
  administration: CAPABILITY_NAV_LABELS.administration,
};

export type RoutePermission = Permission | Permission[] | null;

export interface ProtectedRoute {
  path: string;
  name: string;
  /** Label when actor is a business sponsor (PR-SPONSOR-DOCTRINE-REALIGN-1). */
  businessSponsorName?: string;
  /** null = any authenticated user; array = any listed permission (OR). */
  permission: RoutePermission;
  showInSidebar?: boolean; // Default true, set to false to hide
  /** Sidebar capability section (PR-NAV-CAPABILITY-IA-1); ignored when `showInSidebar === false`. */
  navGroup: NavGroup;
  /** PR-SPONSOR-REFERENCE-ONLY-1 — hidden unless sponsor accountability inbox is enabled. */
  requiresSponsorInbox?: boolean;
  /** PR-CMS-CONNECTOR-1G — hidden unless tenant uses Oracle supplier connector. */
  requiresOracleConnector?: boolean;
  /** PR-CTR-CONNECTOR-1E — hidden unless tenant uses Oracle HCM contractor connector. */
  requiresHcmConnector?: boolean;
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
    name: EXTERNAL_WORKFORCE_LABELS.overview,
    permission: null,
    navGroup: 'overview',
  },
  {
    path: '/suppliers',
    name: 'Suppliers',
    permission: PERMISSIONS.SUPPLIERS.READ,
    navGroup: 'supplierAdministration',
  },
  {
    path: '/supplier-sources/oracle/operations',
    name: SUPPLIER_SYNCHRONIZATION_LABELS.pageTitle,
    permission: PERMISSIONS.SUPPLIERS.READ,
    requiresOracleConnector: true,
    navGroup: 'supplierAdministration',
  },
  {
    path: '/suppliers/approvals',
    name: 'Operational trust queue',
    permission: [PERMISSIONS.SUPPLIERS.APPROVE, PERMISSIONS.SUPPLIERS.SUSPEND],
    navGroup: 'supplierAdministration',
  },
  {
    path: '/suppliers/operational-trust',
    name: 'Operational trust management',
    permission: [PERMISSIONS.SUPPLIERS.APPROVE, PERMISSIONS.SUPPLIERS.SUSPEND],
    navGroup: 'supplierAdministration',
  },
  {
    path: '/contractors',
    name: EXTERNAL_WORKFORCE_LABELS.registry,
    businessSponsorName: EXTERNAL_WORKFORCE_LABELS.sponsoredWorkers,
    permission: PERMISSIONS.CONTRACTORS.READ,
    navGroup: 'workforceAdministration',
  },
  {
    path: '/contractors/workforce-review',
    name: EXTERNAL_WORKFORCE_LABELS.workforceReview,
    permission: PERMISSIONS.CONTRACTORS.READ,
    navGroup: 'workforceAdministration',
  },
  {
    path: '/contractor-sources/oracle-hcm/operations',
    name: EXTERNAL_WORKFORCE_LABELS.workforceImport,
    permission: PERMISSIONS.CONTRACTOR_MIGRATION.READ,
    requiresHcmConnector: true,
    navGroup: 'workforceAdministration',
  },
  {
    path: '/supplier-portal/profile',
    name: 'Supplier profile',
    permission: PERMISSIONS.SUPPLIER_PROFILE.READ,
    navGroup: 'supplierPortal',
  },
  {
    path: '/supplier-portal/contractors',
    name: EXTERNAL_WORKFORCE_LABELS.workers,
    permission: SUPPLIER_PORTAL_CONTRACTOR_READ,
    navGroup: 'supplierPortal',
  },
  {
    path: '/supplier-portal/timesheets',
    name: 'Supplier timesheets',
    permission: PERMISSIONS.SUPPLIER_TIMESHEETS.READ,
    navGroup: 'supplierPortal',
  },
  {
    path: '/supplier-portal/invoices',
    name: 'Supplier invoices',
    permission: PERMISSIONS.SUPPLIER_INVOICES.READ,
    navGroup: 'supplierPortal',
  },
  {
    path: '/contracts',
    name: 'Contracts',
    permission: PERMISSIONS.CONTRACTS.READ,
    navGroup: 'engagementAdministration',
  },
  {
    path: '/engagements',
    name: 'Engagements',
    businessSponsorName: 'My managed engagements',
    permission: PERMISSIONS.ENGAGEMENTS.READ,
    navGroup: 'engagementAdministration',
  },
  {
    path: '/responsible-manager-tasks',
    name: EXTERNAL_WORKFORCE_LABELS.sponsorAccountability,
    businessSponsorName: EXTERNAL_WORKFORCE_LABELS.myResponsibleManagerAccountability,
    permission: PERMISSIONS.RESPONSIBLE_MANAGER_TASKS.READ,
    requiresSponsorInbox: true,
    navGroup: 'engagementAdministration',
  },
  {
    path: '/timesheets',
    name: 'Timesheets',
    permission: PERMISSIONS.TIMESHEETS.READ,
    navGroup: 'engagementAdministration',
  },
  {
    path: '/invoices',
    name: 'Invoices',
    permission: PERMISSIONS.INVOICES.READ,
    navGroup: 'engagementAdministration',
  },
  {
    path: '/projects',
    name: 'Projects',
    permission: PERMISSIONS.PROJECTS.READ,
    navGroup: 'engagementAdministration',
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
    name: GOVERNANCE_NAV_LABELS.auditLogs,
    permission: PERMISSIONS.AUDIT.READ,
    navGroup: 'governance',
  },
  {
    path: '/settings/pdp-activation',
    name: GOVERNANCE_NAV_LABELS.governanceStatus,
    permission: PERMISSIONS.PDP_ACTIVATION.VIEW,
    navGroup: 'governance',
  },
  {
    path: '/settings/pdp-exceptions',
    name: GOVERNANCE_NAV_LABELS.exceptions,
    permission: PERMISSIONS.PDP_EXCEPTIONS.VIEW,
    navGroup: 'governance',
  },
  {
    path: '/settings/audit-insights',
    name: GOVERNANCE_NAV_LABELS.securityInsights,
    permission: PERMISSIONS.AUDIT.READ,
    navGroup: 'governance',
  },
];
