'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Clock, Users } from 'lucide-react';
import { supplierPortalApi } from '@/lib/api-supplier-portal';
import { useSupplierPortalGate } from '@/hooks/use-supplier-portal-gate';
import PortalEmptyState from '@/components/supplier-portal/PortalEmptyState';
import {
  SUPPLIER_NOT_LINKED_MESSAGE,
  SUPPLIER_NOT_LINKED_TITLE,
} from '@/lib/supplier-portal-context';
import {
  getSupplierPortalErrorMessage,
  isSupplierPortalLoadFailure,
} from '@/lib/supplier-portal-errors';
import {
  SupplierPortalDashboardData,
  unwrapSupplierPortalDashboard,
} from '@/lib/supplier-portal-response';
import { useAuth } from '@/lib/auth-context';
import { PERMISSIONS } from '@/lib/permissions.generated';

type WidgetState = 'loading' | 'ready' | 'error' | 'unavailable';

function StatCard({
  label,
  value,
  href,
  icon: Icon,
  borderClass,
  iconBg,
  iconColor,
  state,
  errorMessage,
}: {
  label: string;
  value: string;
  href: string;
  icon: typeof Building2;
  borderClass: string;
  iconBg: string;
  iconColor: string;
  state: WidgetState;
  errorMessage?: string;
}) {
  return (
    <div className={`card border-l-4 ${borderClass}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          {state === 'loading' && (
            <p className="text-sm text-gray-400 mt-1">Loading…</p>
          )}
          {state === 'error' && (
            <p className="text-xs text-red-600 mt-1">{errorMessage ?? 'Unavailable'}</p>
          )}
          {state === 'unavailable' && (
            <p className="text-xs text-gray-400 mt-1">Not available for your role</p>
          )}
          {state === 'ready' && (
            <h3 className="text-2xl font-bold text-gray-900 mt-1">{value}</h3>
          )}
        </div>
        <div className={`p-3 rounded-lg ${iconBg}`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
      </div>
      {state === 'ready' && (
        <Link href={href} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium mt-4 inline-block">
          View details →
        </Link>
      )}
    </div>
  );
}

export default function SupplierPortalDashboardSummary() {
  const { can } = useAuth();
  const { ready, supplierLinked, blockedMessage, guardApiCall } = useSupplierPortalGate();
  const canProfile = can(PERMISSIONS.SUPPLIER_PROFILE.READ);
  const canContractors = can(PERMISSIONS.SUPPLIER_CONTRACTORS.READ);
  const canTimesheets = can(PERMISSIONS.SUPPLIER_TIMESHEETS.READ);

  const [data, setData] = useState<SupplierPortalDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    if (!guardApiCall(true)) {
      setLoading(false);
      setData(null);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await supplierPortalApi.getDashboard();
      setData(unwrapSupplierPortalDashboard(res));
    } catch (err) {
      if (isSupplierPortalLoadFailure(err)) {
        setError(
          getSupplierPortalErrorMessage(
            err,
            'The server could not load supplier dashboard data.',
          ),
        );
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [guardApiCall]);

  useEffect(() => {
    if (ready) loadDashboard();
  }, [ready, loadDashboard]);

  if (!ready) {
    return <p className="text-sm text-gray-500">Loading supplier dashboard…</p>;
  }

  if (!supplierLinked) {
    return (
      <PortalEmptyState
        icon={Building2}
        title={SUPPLIER_NOT_LINKED_TITLE}
        description={blockedMessage ?? SUPPLIER_NOT_LINKED_MESSAGE}
      />
    );
  }

  if (error) {
    return (
      <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
    );
  }

  const profileState: WidgetState = !canProfile
    ? 'unavailable'
    : loading
      ? 'loading'
      : 'ready';
  const contractorState: WidgetState = !canContractors
    ? 'unavailable'
    : loading
      ? 'loading'
      : 'ready';
  const timesheetState: WidgetState = !canTimesheets
    ? 'unavailable'
    : loading
      ? 'loading'
      : 'ready';

  const profileLabel =
    data?.profile.available && data.profile.display_name
      ? data.profile.display_name
      : data?.profile.available
        ? 'Profile on file'
        : 'No profile';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Supplier profile"
          value={profileLabel}
          href="/supplier-portal/profile"
          icon={Building2}
          borderClass="border-indigo-500"
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
          state={profileState}
        />
        <StatCard
          label="External workers"
          value={String(data?.contractors.count ?? 0)}
          href="/supplier-portal/contractors"
          icon={Users}
          borderClass="border-blue-500"
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          state={contractorState}
        />
        <StatCard
          label="Pending timesheets"
          value={String(data?.timesheets.pending ?? 0)}
          href="/supplier-portal/timesheets"
          icon={Clock}
          borderClass="border-amber-500"
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          state={timesheetState}
        />
      </div>
      {!loading && data && data.timesheets.total === 0 && canTimesheets && (
        <p className="text-sm text-gray-500">No timesheets submitted yet.</p>
      )}
      {!loading && data && data.contractors.count === 0 && canContractors && (
        <p className="text-sm text-gray-500">No contractors assigned to your supplier yet.</p>
      )}
    </div>
  );
}
