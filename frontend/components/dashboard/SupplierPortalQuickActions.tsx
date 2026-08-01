'use client';

import Link from 'next/link';
import { Building2, FileText, UserPlus, Clock } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PERMISSIONS } from '@/lib/permissions.generated';
import { SUPPLIER_NOT_LINKED_MESSAGE } from '@/lib/supplier-portal-context';

type QuickAction = {
  label: string;
  href: string;
  icon: typeof UserPlus;
  disabled?: boolean;
  disabledReason?: string;
};

export default function SupplierPortalQuickActions() {
  const { can, user } = useAuth();
  const supplierLinked = Boolean(user?.supplierId);

  const actions: QuickAction[] = [];

  if (can(PERMISSIONS.SUPPLIER_CONTRACTORS.CREATE)) {
    actions.push({
      label: 'Nominate worker',
      href: '/supplier-portal/contractors',
      icon: UserPlus,
      disabled: !supplierLinked,
      disabledReason: SUPPLIER_NOT_LINKED_MESSAGE,
    });
  }
  if (can(PERMISSIONS.SUPPLIER_TIMESHEETS.SUBMIT)) {
    actions.push({
      label: 'Submit timesheet',
      href: '/supplier-portal/timesheets',
      icon: Clock,
      disabled: !supplierLinked,
      disabledReason: SUPPLIER_NOT_LINKED_MESSAGE,
    });
  }
  if (can(PERMISSIONS.SUPPLIER_INVOICES.READ)) {
    actions.push({
      label: 'View invoice status',
      href: '/supplier-portal/invoices',
      icon: FileText,
      disabled: !supplierLinked,
      disabledReason: SUPPLIER_NOT_LINKED_MESSAGE,
    });
  }
  if (can(PERMISSIONS.SUPPLIER_PROFILE.UPDATE)) {
    actions.push({
      label: 'Update company details',
      href: '/supplier-portal/profile',
      icon: Building2,
      disabled: !supplierLinked,
      disabledReason: SUPPLIER_NOT_LINKED_MESSAGE,
    });
  }

  if (actions.length === 0) {
    return null;
  }

  return (
    <section className="card" data-testid="supplier-quick-actions">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-4">
        Quick actions
      </h3>
      {!supplierLinked && (
        <p
          className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 mb-4"
          role="status"
          data-testid="supplier-quick-actions-membership-required"
        >
          {SUPPLIER_NOT_LINKED_MESSAGE}
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {actions.map((action) => {
          const Icon = action.icon;
          if (action.disabled) {
            return (
              <div
                key={action.href}
                className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-400 cursor-not-allowed"
                title={action.disabledReason}
                data-testid={`supplier-quick-action-disabled-${action.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {action.label}
              </div>
            );
          }
          return (
            <Link
              key={action.href}
              href={action.href}
              className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-900 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors"
            >
              <Icon className="h-4 w-4 text-indigo-600 shrink-0" />
              {action.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
