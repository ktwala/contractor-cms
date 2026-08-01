'use client';

import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import RequirePermission from '@/components/RequirePermission';
import PortalPageHeader from '@/components/supplier-portal/PortalPageHeader';
import PortalEmptyState from '@/components/supplier-portal/PortalEmptyState';
import StatusBadge from '@/components/ui/status-badge';
import { PERMISSIONS } from '@/lib/permissions.generated';
import { supplierPortalApi } from '@/lib/api-supplier-portal';
import {
  getSupplierPortalErrorMessage,
  isSupplierPortalLoadFailure,
} from '@/lib/supplier-portal-errors';
import { SUPPLIER_NOT_LINKED_TITLE } from '@/lib/supplier-portal-context';
import {
  SUPPLIER_PORTAL_EMPTY_COPY,
  SUPPLIER_PORTAL_EMPTY_STATES,
  unwrapSupplierPortalList,
} from '@/lib/supplier-portal-response';
import { useSupplierPortalGate } from '@/hooks/use-supplier-portal-gate';
import { safeFormatDate, safeString } from '@/lib/safe-string';
import { Clock } from 'lucide-react';

interface PortalTimesheet {
  id: string;
  periodStart: string;
  periodEnd: string;
  totalHours: number | string;
  status: string;
  contractor?: { firstName: string; lastName: string; email: string };
}

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

export default function SupplierPortalTimesheetsPage() {
  const { ready, supplierLinked, blockedMessage, guardApiCall } = useSupplierPortalGate();
  const [timesheets, setTimesheets] = useState<PortalTimesheet[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadTimesheets = useCallback(async () => {
    if (!guardApiCall(true)) {
      setLoading(false);
      setTimesheets([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const params: Record<string, unknown> = { page: 1, limit: 100 };
      if (statusFilter) params.status = statusFilter;
      const res = await supplierPortalApi.getTimesheets(params);
      const { items } = unwrapSupplierPortalList<PortalTimesheet>(res);
      setTimesheets(items);
    } catch (err) {
      if (isSupplierPortalLoadFailure(err)) {
        setError(
          getSupplierPortalErrorMessage(
            err,
            'The server could not load timesheets for your contractors.',
          ),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, guardApiCall]);

  useEffect(() => {
    if (ready) loadTimesheets();
  }, [ready, loadTimesheets]);

  const filtered = timesheets;

  return (
    <RequirePermission permission={PERMISSIONS.SUPPLIER_TIMESHEETS.READ}>
      <DashboardLayout>
        <div className="space-y-6">
          <PortalPageHeader
            title="Timesheets"
            description="Review time submissions for contractors under your supplier membership."
          />

          {supplierLinked && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-gray-600" htmlFor="ts-status">
              Filter
            </label>
            <select
              id="ts-status"
              className="input max-w-xs"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {STATUS_FILTERS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          )}

          {!supplierLinked && ready && (
            <PortalEmptyState
              icon={Clock}
              title={SUPPLIER_NOT_LINKED_TITLE}
              description={blockedMessage ?? 'No supplier membership is active for your account.'}
            />
          )}

          {supplierLinked && loading && (
            <p className="text-sm text-gray-500">Loading timesheets…</p>
          )}
          {supplierLinked && error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
          )}

          {supplierLinked && !loading && !error && filtered.length === 0 && (
            <PortalEmptyState
              icon={Clock}
              title={
                statusFilter
                  ? 'No timesheets match this filter'
                  : SUPPLIER_PORTAL_EMPTY_COPY[SUPPLIER_PORTAL_EMPTY_STATES.NO_TIMESHEETS]
                      .title
              }
              description={
                statusFilter
                  ? 'No timesheets match this status for your contractors.'
                  : SUPPLIER_PORTAL_EMPTY_COPY[SUPPLIER_PORTAL_EMPTY_STATES.NO_TIMESHEETS]
                      .description
              }
            />
          )}

          {supplierLinked && !loading && filtered.length > 0 && (
            <div className="overflow-hidden card p-0">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Resource
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Period
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Hours
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filtered.map((ts) => (
                    <tr key={ts.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        <p className="font-medium text-gray-900">
                          {ts.contractor
                            ? `${safeString(ts.contractor.firstName)} ${safeString(ts.contractor.lastName)}`
                            : 'Resource'}
                        </p>
                        {ts.contractor?.email && (
                          <p className="text-gray-500 text-xs">{ts.contractor.email}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {safeFormatDate(ts.periodStart, 'dd MMM yyyy')} –{' '}
                        {safeFormatDate(ts.periodEnd, 'dd MMM yyyy')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {Number(ts.totalHours)}h
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={ts.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DashboardLayout>
    </RequirePermission>
  );
}
