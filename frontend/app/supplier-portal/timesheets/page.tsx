'use client';

import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import RequirePermission from '@/components/RequirePermission';
import PortalPageHeader from '@/components/supplier-portal/PortalPageHeader';
import PortalEmptyState from '@/components/supplier-portal/PortalEmptyState';
import StatusBadge from '@/components/ui/status-badge';
import { PERMISSIONS } from '@/lib/permissions.generated';
import { supplierPortalApi } from '@/lib/api-supplier-portal';
import { format } from 'date-fns';
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
  const [timesheets, setTimesheets] = useState<PortalTimesheet[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadTimesheets = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, unknown> = { page: 1, limit: 100 };
      if (statusFilter) params.status = statusFilter;
      const res = await supplierPortalApi.getTimesheets(params);
      setTimesheets(res.data || []);
    } catch {
      setError('Failed to load timesheets for your resources.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadTimesheets();
  }, [loadTimesheets]);

  const filtered = timesheets;

  return (
    <RequirePermission permission={PERMISSIONS.SUPPLIER_TIMESHEETS.READ}>
      <DashboardLayout>
        <div className="space-y-6">
          <PortalPageHeader
            title="Timesheets"
            description="Review time submissions for contractors under your supplier membership."
          />

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

          {loading && <p className="text-sm text-gray-500">Loading timesheets…</p>}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
          )}

          {!loading && !error && filtered.length === 0 && (
            <PortalEmptyState
              icon={Clock}
              title="No timesheets found"
              description={
                statusFilter
                  ? 'No timesheets match this status for your resources.'
                  : 'When your resources submit timesheets, they will appear here.'
              }
            />
          )}

          {!loading && filtered.length > 0 && (
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
                            ? `${ts.contractor.firstName} ${ts.contractor.lastName}`
                            : 'Resource'}
                        </p>
                        {ts.contractor?.email && (
                          <p className="text-gray-500 text-xs">{ts.contractor.email}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {format(new Date(ts.periodStart), 'dd MMM yyyy')} –{' '}
                        {format(new Date(ts.periodEnd), 'dd MMM yyyy')}
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
