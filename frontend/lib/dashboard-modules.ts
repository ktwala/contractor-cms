import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  Users,
  FileText,
  Briefcase,
  ClipboardList,
  Clock,
  Receipt,
  FolderKanban,
  CloudDownload,
} from 'lucide-react';
import { PERMISSIONS, type Permission } from './permissions.generated';
import { BUSINESS_RESPONSIBLE_MANAGER_NAV_LABELS } from './business-responsible-manager';
import {
  type TenantAuthorityProfile,
  usesHcmContractorConnector,
  usesOracleSupplierConnector,
} from './tenant-authority';
import { EXTERNAL_WORKFORCE_LABELS } from './external-workforce-labels';
import { SUPPLIER_SYNCHRONIZATION_LABELS } from './supplier-synchronization-labels';

export type DashboardModuleId =
  | 'suppliers'
  | 'supplier-sync'
  | 'contractors'
  | 'contractor-bootstrap'
  | 'contracts'
  | 'engagements'
  | 'responsible-manager-tasks'
  | 'timesheets'
  | 'invoices'
  | 'projects';

export interface DashboardModuleDef {
  id: DashboardModuleId;
  /** Lower sorts first among visible cards. */
  sortOrder: number;
  /** Any listed permission grants the card (OR). */
  permissions: Permission[];
  requiresOracleSupplierConnector?: boolean;
  requiresHcmContractorConnector?: boolean;
  href: string;
  title: string;
  businessSponsorTitle?: string;
  description: string;
  businessSponsorDescription?: string;
  icon: LucideIcon;
  borderClass: string;
  iconBgClass: string;
  iconClass: string;
}

/** Nav cards — same authority as sidebar (`permission` must match PROTECTED_ROUTES). */
export const DASHBOARD_MODULES: DashboardModuleDef[] = [
  {
    id: 'suppliers',
    sortOrder: 10,
    permissions: [PERMISSIONS.SUPPLIERS.READ],
    href: '/suppliers',
    title: 'Suppliers',
    description: 'Governed supplier registry',
    icon: Building2,
    borderClass: 'border-indigo-500',
    iconBgClass: 'bg-indigo-50',
    iconClass: 'text-indigo-600',
  },
  {
    id: 'supplier-sync',
    sortOrder: 15,
    permissions: [PERMISSIONS.SUPPLIERS.READ],
    requiresOracleSupplierConnector: true,
    href: '/supplier-sources/oracle/operations',
    title: SUPPLIER_SYNCHRONIZATION_LABELS.pageTitle,
    description: 'Synchronize supplier metadata & govern participation',
    icon: CloudDownload,
    borderClass: 'border-indigo-400',
    iconBgClass: 'bg-indigo-50',
    iconClass: 'text-indigo-700',
  },
  {
    id: 'contractors',
    sortOrder: 20,
    permissions: [PERMISSIONS.CONTRACTORS.READ],
    href: '/contractors',
    title: EXTERNAL_WORKFORCE_LABELS.registry,
    businessSponsorTitle: BUSINESS_RESPONSIBLE_MANAGER_NAV_LABELS.contractors,
    description: 'Governed external worker records',
    businessSponsorDescription: EXTERNAL_WORKFORCE_LABELS.sponsoredWorkers,
    icon: Users,
    borderClass: 'border-blue-500',
    iconBgClass: 'bg-blue-50',
    iconClass: 'text-blue-600',
  },
  {
    id: 'contractor-bootstrap',
    sortOrder: 25,
    permissions: [PERMISSIONS.CONTRACTOR_MIGRATION.READ],
    requiresHcmContractorConnector: true,
    href: '/contractor-sources/oracle-hcm/operations',
    title: EXTERNAL_WORKFORCE_LABELS.workforceImport,
    description: 'Bring external workers into EWP from upstream sources',
    icon: CloudDownload,
    borderClass: 'border-violet-500',
    iconBgClass: 'bg-violet-50',
    iconClass: 'text-violet-700',
  },
  {
    id: 'contracts',
    sortOrder: 30,
    permissions: [PERMISSIONS.CONTRACTS.READ],
    href: '/contracts',
    title: 'Contracts',
    description: 'Supplier agreements',
    icon: FileText,
    borderClass: 'border-purple-500',
    iconBgClass: 'bg-purple-50',
    iconClass: 'text-purple-600',
  },
  {
    id: 'engagements',
    sortOrder: 40,
    permissions: [PERMISSIONS.ENGAGEMENTS.READ],
    href: '/engagements',
    title: 'Engagements',
    businessSponsorTitle: BUSINESS_RESPONSIBLE_MANAGER_NAV_LABELS.engagements,
    description: 'External worker placements',
    businessSponsorDescription: 'Placements where you are accountable sponsor',
    icon: Briefcase,
    borderClass: 'border-violet-500',
    iconBgClass: 'bg-violet-50',
    iconClass: 'text-violet-600',
  },
  {
    id: 'responsible-manager-tasks',
    sortOrder: 50,
    permissions: [PERMISSIONS.RESPONSIBLE_MANAGER_TASKS.READ],
    href: '/responsible-manager-tasks',
    title: EXTERNAL_WORKFORCE_LABELS.sponsorAccountability,
    businessSponsorTitle: BUSINESS_RESPONSIBLE_MANAGER_NAV_LABELS.tasks,
    description: 'Sponsor accountability inbox',
    businessSponsorDescription: 'Certification, access, renewal, and offboarding accountability',
    icon: ClipboardList,
    borderClass: 'border-teal-500',
    iconBgClass: 'bg-teal-50',
    iconClass: 'text-teal-600',
  },
  {
    id: 'timesheets',
    sortOrder: 60,
    permissions: [PERMISSIONS.TIMESHEETS.READ],
    href: '/timesheets',
    title: 'Timesheets',
    description: 'Review and approve',
    icon: Clock,
    borderClass: 'border-amber-500',
    iconBgClass: 'bg-amber-50',
    iconClass: 'text-amber-600',
  },
  {
    id: 'invoices',
    sortOrder: 70,
    permissions: [PERMISSIONS.INVOICES.READ],
    href: '/invoices',
    title: 'Invoices',
    description: 'Billing and payments',
    icon: Receipt,
    borderClass: 'border-emerald-500',
    iconBgClass: 'bg-emerald-50',
    iconClass: 'text-emerald-600',
  },
  {
    id: 'projects',
    sortOrder: 80,
    permissions: [PERMISSIONS.PROJECTS.READ],
    href: '/projects',
    title: 'Projects',
    description: 'Project portfolio',
    icon: FolderKanban,
    borderClass: 'border-slate-500',
    iconBgClass: 'bg-slate-50',
    iconClass: 'text-slate-600',
  },
];

export function filterDashboardModules(
  can: (permission: Permission) => boolean,
  user?: { externalId?: string | null } | null,
  tenantAuthority?: TenantAuthorityProfile | null,
): DashboardModuleDef[] {
  const businessSponsor =
    Boolean(user?.externalId?.trim()) &&
    can(PERMISSIONS.CONTRACTORS.READ) &&
    can(PERMISSIONS.ENGAGEMENTS.READ) &&
    !can(PERMISSIONS.SUPPLIER_PROFILE.READ);

  return DASHBOARD_MODULES.filter((m) => {
    if (!m.permissions.some((p) => can(p))) return false;
    if (m.requiresOracleSupplierConnector && !usesOracleSupplierConnector(tenantAuthority)) {
      return false;
    }
    if (m.requiresHcmContractorConnector && !usesHcmContractorConnector(tenantAuthority)) {
      return false;
    }
    return true;
  })
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(
    (m) =>
      businessSponsor
        ? {
            ...m,
            title: m.businessSponsorTitle ?? m.title,
            description: m.businessSponsorDescription ?? m.description,
          }
        : m,
  );
}
