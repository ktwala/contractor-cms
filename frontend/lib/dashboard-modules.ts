import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  Users,
  FileText,
  Briefcase,
  Clock,
  Receipt,
  FolderKanban,
} from 'lucide-react';
import { PERMISSIONS, type Permission } from './permissions.generated';

export type DashboardModuleId =
  | 'suppliers'
  | 'contractors'
  | 'contracts'
  | 'engagements'
  | 'timesheets'
  | 'invoices'
  | 'projects';

export interface DashboardModuleDef {
  id: DashboardModuleId;
  /** Any listed permission grants the card (OR). */
  permissions: Permission[];
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  borderClass: string;
  iconBgClass: string;
  iconClass: string;
}

/** Nav cards — same authority as sidebar (`permission` must match PROTECTED_ROUTES). */
export const DASHBOARD_MODULES: DashboardModuleDef[] = [
  {
    id: 'suppliers',
    permissions: [PERMISSIONS.SUPPLIERS.READ, PERMISSIONS.SUPPLIER_PROFILE.READ],
    href: '/suppliers',
    title: 'Suppliers',
    description: 'Manage supplier entities',
    icon: Building2,
    borderClass: 'border-indigo-500',
    iconBgClass: 'bg-indigo-50',
    iconClass: 'text-indigo-600',
  },
  {
    id: 'contractors',
    permissions: [PERMISSIONS.CONTRACTORS.READ],
    href: '/contractors',
    title: 'Contractors',
    description: 'Manage individuals',
    icon: Users,
    borderClass: 'border-blue-500',
    iconBgClass: 'bg-blue-50',
    iconClass: 'text-blue-600',
  },
  {
    id: 'contracts',
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
    permissions: [PERMISSIONS.ENGAGEMENTS.READ],
    href: '/engagements',
    title: 'Engagements',
    description: 'Contractor placements',
    icon: Briefcase,
    borderClass: 'border-violet-500',
    iconBgClass: 'bg-violet-50',
    iconClass: 'text-violet-600',
  },
  {
    id: 'timesheets',
    permissions: [PERMISSIONS.TIMESHEETS.READ, PERMISSIONS.SUPPLIER_TIMESHEETS.READ],
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
): DashboardModuleDef[] {
  return DASHBOARD_MODULES.filter((m) => m.permissions.some((p) => can(p)));
}
