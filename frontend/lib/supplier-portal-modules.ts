import { Building2, Users, Clock } from 'lucide-react';
import { PERMISSIONS, type Permission } from './permissions.generated';
import {
  SUPPLIER_PORTAL_CONTRACTOR_READ,
  canAccessSupplierPortalContractors,
} from './supplier-portal-permissions';

export interface SupplierPortalModuleDef {
  id: string;
  permissions: Permission[];
  href: string;
  title: string;
  description: string;
  icon: typeof Building2;
  borderClass: string;
  iconBgClass: string;
  iconClass: string;
}

/** Dashboard cards for supplier-portal users (PR-SUPPLIER-PORTAL-UI-1). */
export const SUPPLIER_PORTAL_MODULES: SupplierPortalModuleDef[] = [
  {
    id: 'portal-profile',
    permissions: [PERMISSIONS.SUPPLIER_PROFILE.READ],
    href: '/supplier-portal/profile',
    title: 'Supplier profile',
    description: 'Your supplier organization profile',
    icon: Building2,
    borderClass: 'border-indigo-500',
    iconBgClass: 'bg-indigo-50',
    iconClass: 'text-indigo-600',
  },
  {
    id: 'portal-contractors',
    permissions: [SUPPLIER_PORTAL_CONTRACTOR_READ],
    href: '/supplier-portal/contractors',
    title: 'Contractors',
    description: 'Supplier-scoped contractors for your organization',
    icon: Users,
    borderClass: 'border-blue-500',
    iconBgClass: 'bg-blue-50',
    iconClass: 'text-blue-600',
  },
  {
    id: 'portal-timesheets',
    permissions: [PERMISSIONS.SUPPLIER_TIMESHEETS.READ],
    href: '/supplier-portal/timesheets',
    title: 'Timesheets',
    description: 'Timesheets for your supplier contractors',
    icon: Clock,
    borderClass: 'border-amber-500',
    iconBgClass: 'bg-amber-50',
    iconClass: 'text-amber-600',
  },
];

export function filterSupplierPortalModules(
  can: (permission: Permission) => boolean,
): SupplierPortalModuleDef[] {
  return SUPPLIER_PORTAL_MODULES.filter((m) => m.permissions.some((p) => can(p)));
}

/** True when user should use portal surfaces, not client /suppliers. */
export function isSupplierPortalUser(can: (permission: Permission) => boolean): boolean {
  return (
    can(PERMISSIONS.SUPPLIER_PROFILE.READ) ||
    canAccessSupplierPortalContractors(can) ||
    can(PERMISSIONS.SUPPLIER_TIMESHEETS.READ)
  ) && !can(PERMISSIONS.SUPPLIERS.READ);
}
